package kube

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"iappx_k8s_admin/core/services/journal"
)

func newRecordedJournal(t *testing.T) *journal.Journal {
	t.Helper()

	recorded, err := journal.Open(journal.Options{Dir: t.TempDir()})
	if err != nil {
		t.Fatalf("journal unavailable: %v", err)
	}

	journal.SetDefault(recorded)
	t.Cleanup(func() {
		journal.SetDefault(nil)
		recorded.Close()
	})

	return recorded
}

func journalContent(t *testing.T, recorded *journal.Journal) string {
	t.Helper()

	content, err := os.ReadFile(filepath.FromSlash(recorded.Path()))
	if err != nil {
		t.Fatalf("could not read the journal: %v", err)
	}

	return string(content)
}

func journalEntries(t *testing.T, recorded *journal.Journal) []map[string]any {
	t.Helper()

	entries := make([]map[string]any, 0)
	for _, raw := range strings.Split(strings.TrimSpace(journalContent(t, recorded)), "\n") {
		if raw == "" {
			continue
		}

		decoded := map[string]any{}
		if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
			t.Fatalf("a journal line is not valid json: %v", err)
		}
		entries = append(entries, decoded)
	}

	return entries
}

func journalEvents(t *testing.T, recorded *journal.Journal) []string {
	t.Helper()

	events := make([]string, 0)
	for _, entry := range journalEntries(t, recorded) {
		event, _ := entry["event"].(string)
		events = append(events, event)
	}

	return events
}

func journalEntry(t *testing.T, recorded *journal.Journal, event string) map[string]any {
	t.Helper()

	for _, entry := range journalEntries(t, recorded) {
		if entry["event"] == event {
			return entry
		}
	}

	t.Fatalf("the journal has no %q entry, only %v", event, journalEvents(t, recorded))
	return nil
}

func TestStreamJournalsItsOpeningAndItsStop(t *testing.T) {
	const path = "/api/v1/namespaces/default/pods"

	recorded := newRecordedJournal(t)
	server := newIdleStreamServer(t)

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	result := service.StartStream(StreamRequest{
		SessionId: sessionId,
		Method:    "GET",
		Path:      path + "?watch=true",
	})
	if !result.Success {
		t.Fatalf("stream did not start: %s", result.Error)
	}
	if stopped := service.StopStream(result.StreamId); !stopped.Success {
		t.Fatalf("stop failed: %s", stopped.Error)
	}

	opened := journalEntry(t, recorded, "stream.open")
	if opened["method"] != "GET" || opened["path"] != path {
		t.Fatalf("unexpected open entry: %v", opened)
	}
	if opened["session"] != sessionId {
		t.Fatalf("the open entry names another session: %v", opened["session"])
	}
	if opened["status"] != float64(http.StatusOK) {
		t.Fatalf("unexpected open status: %v", opened["status"])
	}

	closed := journalEntry(t, recorded, "stream."+StreamStatusStopped)
	if closed["session"] != sessionId || closed["path"] != path {
		t.Fatalf("unexpected close entry: %v", closed)
	}
}

func TestStreamJournalsTheEndOfAStream(t *testing.T) {
	recorded := newRecordedJournal(t)

	server := newTlsServer(t, func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("only-line\n"))
	})

	service, registry, emitter := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	result := service.StartStream(StreamRequest{SessionId: sessionId, Path: "/api/v1/pods?watch=true"})
	if !result.Success {
		t.Fatalf("stream did not start: %s", result.Error)
	}

	emitter.await(t, "the close event", func() bool {
		_, found := emitter.closeStatus(result.StreamId)
		return found
	})

	if events := journalEvents(t, recorded); !slices.Contains(events, "stream."+StreamStatusEof) {
		t.Fatalf("the end of the stream was not journalled: %v", events)
	}
}

func TestStreamRejectionJournalsTheStatusAndNotTheResponseBody(t *testing.T) {
	const bodyToken = "SYNTHETIC-BODY-TOKEN-2f8a10"
	const body = `{"kind":"Status","code":403,"reason":"Forbidden","message":"` + bodyToken + `"}`

	recorded := newRecordedJournal(t)

	server := newTlsServer(t, func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusForbidden)
		_, _ = writer.Write([]byte(body))
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	result := service.StartStream(StreamRequest{SessionId: sessionId, Path: "/api/v1/pods?watch=true"})
	if result.Success {
		t.Fatal("a rejected stream must not report success")
	}
	if result.Error != body {
		t.Fatal("the status document must still reach the caller")
	}

	if strings.Contains(journalContent(t, recorded), bodyToken) {
		t.Fatal("the journal carries the server's response body")
	}

	rejected := journalEntry(t, recorded, "stream.rejected")
	if rejected["status"] != float64(http.StatusForbidden) {
		t.Fatalf("expected the rejection status in the journal, got %v", rejected["status"])
	}
	if _, found := rejected["message"]; found {
		t.Fatal("a rejection answered by the server must journal no message")
	}
}

func TestStreamJournalKeepsQueryHeadersAndCredentialsOut(t *testing.T) {
	const queryToken = "SYNTHETIC-QUERY-TOKEN-4b71fa"
	const bearerToken = "SYNTHETIC-BEARER-TOKEN-9c02de"
	const urlPassword = "SYNTHETIC-URL-PASSWORD-1de55a"
	const watchPath = "/api/v1/namespaces/default/pods?watch=true&access_token=" + queryToken

	recorded := newRecordedJournal(t)
	server := newIdleStreamServer(t)

	service, registry, _ := newTestService(t)
	sessionId := connect(t, registry, ConnectionSpec{
		Server: strings.Replace(server.URL, "https://", "https://operator:"+urlPassword+"@", 1),
		CaPem:  encodePem("CERTIFICATE", server.Certificate().Raw),
		Token:  bearerToken,
	})

	started := service.StartStream(StreamRequest{
		SessionId: sessionId,
		Path:      watchPath,
		Headers:   map[string]string{"Authorization": "Bearer " + bearerToken},
	})
	if !started.Success {
		t.Fatalf("stream did not start: %s", started.Error)
	}
	if stopped := service.StopStream(started.StreamId); !stopped.Success {
		t.Fatalf("stop failed: %s", stopped.Error)
	}

	unreachable := connect(t, registry, ConnectionSpec{
		Server:                "https://operator:" + urlPassword + "@127.0.0.1:1",
		Token:                 bearerToken,
		InsecureSkipTlsVerify: true,
	})
	if refused := service.StartStream(StreamRequest{SessionId: unreachable, Path: watchPath}); refused.Success {
		t.Fatal("a stream to a closed port must not start")
	}

	forbidden := map[string]string{
		"query token":          queryToken,
		"bearer token":         bearerToken,
		"url password":         urlPassword,
		"query parameter name": "access_token",
		"watch parameter":      "watch=true",
		"authorization header": "Authorization",
	}

	content := journalContent(t, recorded)
	for label, secret := range forbidden {
		if strings.Contains(content, secret) {
			t.Fatalf("the journal leaks the %s", label)
		}
	}

	allowed := map[string]bool{
		"time":       true,
		"level":      true,
		"component":  true,
		"event":      true,
		"method":     true,
		"path":       true,
		"status":     true,
		"session":    true,
		"durationMs": true,
		"message":    true,
		"trace":      true,
	}

	entries := journalEntries(t, recorded)
	if len(entries) == 0 {
		t.Fatal("the streams were not journalled at all")
	}

	for _, entry := range entries {
		for field := range entry {
			if !allowed[field] {
				t.Fatalf("a journal entry carries an unexpected field: %q", field)
			}
		}
		if path, _ := entry["path"].(string); strings.ContainsAny(path, "?&") {
			t.Fatalf("a journal path carries a query: %q", path)
		}
	}

	events := journalEvents(t, recorded)
	for _, expected := range []string{"stream.open", "stream." + StreamStatusStopped} {
		if !slices.Contains(events, expected) {
			t.Fatalf("the journal has no %q entry, only %v", expected, events)
		}
	}

	rejected := journalEntry(t, recorded, "stream.rejected")
	if message, _ := rejected["message"].(string); message == "" {
		t.Fatal("the refused dial journalled no message, so nothing was filtered")
	}
}
