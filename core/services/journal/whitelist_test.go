package journal

import (
	"strings"
	"testing"
	"time"
)

// Synthetic look-alikes: nothing here is or ever was a working credential.
const (
	fakeBearerToken   = "eyJhbGciOiJIUzI1NiJ9.c3ludGhldGljLXRlc3QtcGF5bG9hZA.c2lnbmF0dXJlLXZhbHVl"
	fakeClientKeyData = "LS0tLS1CRUdJTlBSSVZBVEVLRVktLS0tLXN5bnRoZXRpYy10ZXN0LWtleQ=="
	fakeSecretBody    = `{"kind":"Secret","data":{"password":"c3ludGhldGljLXBhc3N3b3JkLXZhbHVl"}}`
	fakeEnvValue      = "KUBIQ_TEST_TOKEN=Zm9vLXN5bnRoZXRpYy1zZWNyZXQtdmFsdWU="
)

func TestJournalNeverWritesCredentials(t *testing.T) {
	journal := newJournal(t, Options{})

	entries := []Entry{
		{
			Level:     LevelError,
			Component: "kube",
			Event:     "request",
			Method:    "GET",
			Path:      "/api/v1/namespaces/default/secrets/db?token=" + fakeBearerToken,
			Status:    401,
			Message:   "authorization: Bearer " + fakeBearerToken,
		},
		{
			Level:     LevelError,
			Component: "kube",
			Event:     "connection.rejected",
			Path:      "https://operator:hunter2synthetic@cluster.example.com:6443/api/v1/pods",
			Message:   "kubeconfig rejected: client-key-data: " + fakeClientKeyData,
		},
		{
			Level:     LevelWarn,
			Component: "kube",
			Event:     "request",
			Message:   "unexpected payload " + fakeSecretBody,
			Trace:     "at authorize (app://bundle.js:42:7) token=" + fakeBearerToken,
		},
		{
			Level:     LevelError,
			Component: "process",
			Event:     "spawn",
			Message:   "environment rejected " + fakeEnvValue,
		},
	}

	for _, entry := range entries {
		if err := journal.Write(entry); err != nil {
			t.Fatalf("unexpected failure: %v", err)
		}
	}

	content := strings.Join(readLines(t, journal.Path()), "\n")

	forbidden := []string{
		fakeBearerToken,
		"eyJhbGciOiJIUzI1NiJ9",
		fakeClientKeyData,
		"c3ludGhldGljLXBhc3N3b3JkLXZhbHVl",
		fakeEnvValue,
		"Zm9vLXN5bnRoZXRpYy1zZWNyZXQtdmFsdWU=",
		"hunter2synthetic",
		"token=",
	}

	for _, secret := range forbidden {
		if strings.Contains(content, secret) {
			t.Fatalf("the journal reproduced a credential-shaped value: %q", secret)
		}
	}

	if !strings.Contains(content, "/api/v1/namespaces/default/secrets/db") {
		t.Fatalf("the request path was lost along with the query: %s", content)
	}
	if !strings.Contains(content, "cluster.example.com:6443") {
		t.Fatalf("the server address was lost along with the user info: %s", content)
	}
}

func TestOnlyWhitelistedKeysReachTheJournal(t *testing.T) {
	journal := newJournal(t, Options{})

	entry := Entry{
		Level:     LevelError,
		Component: "kube",
		Event:     "request",
		Method:    "POST",
		Path:      "/api/v1/namespaces/default/pods",
		Status:    503,
		Session:   "a1b2c3d4",
		Duration:  42,
		Message:   "the api server is unavailable",
		Trace:     "at send (app://bundle.js:12:3)",
	}

	if err := journal.Write(entry); err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}

	allowed := map[string]struct{}{
		"time": {}, "level": {}, "component": {}, "event": {}, "method": {},
		"path": {}, "status": {}, "session": {}, "durationMs": {}, "message": {}, "trace": {},
	}

	for key := range decodeLine(t, readLines(t, journal.Path())[0]) {
		if _, found := allowed[key]; !found {
			t.Fatalf("an unexpected key reached the journal: %q", key)
		}
	}
}

func TestUnknownLevelsMethodsAndStatusesAreNormalised(t *testing.T) {
	normalised := normalise(Entry{
		Level:   "CRITICAL",
		Method:  "TRACEROUTE",
		Status:  999,
		Session: "not a session id",
		Event:   "Kube Request!",
	}, time.Unix(0, 0))

	if normalised.Level != LevelInfo {
		t.Fatalf("expected an unknown level to fall back to %q, got %q", LevelInfo, normalised.Level)
	}
	if normalised.Method != invalid {
		t.Fatalf("expected an unknown method to be rejected, got %q", normalised.Method)
	}
	if normalised.Status != 0 {
		t.Fatalf("expected an out-of-range status to be dropped, got %d", normalised.Status)
	}
	if normalised.Session != invalid || normalised.Event != invalid {
		t.Fatalf("expected malformed identifiers to be rejected: %+v", normalised)
	}
}

func TestProseSurvivesTheWhitelist(t *testing.T) {
	message := "the api server refused the request after 3 retries (ResourceQuotaExceeded)"

	if got := text(message); got != message {
		t.Fatalf("plain prose was mangled:\n  want %q\n  got  %q", message, got)
	}
}

func TestOpaqueValuesAreDroppedFromText(t *testing.T) {
	got := text("failed with " + fakeBearerToken + " while reading")

	if strings.Contains(got, "eyJ") {
		t.Fatalf("an opaque value survived: %q", got)
	}
	if !strings.Contains(got, "failed with") || !strings.Contains(got, "while reading") {
		t.Fatalf("the surrounding message was lost: %q", got)
	}
}

func TestControlCharactersAreDropped(t *testing.T) {
	if got := text("line\x00break"); got != dropped {
		t.Fatalf("expected a control character to drop the word, got %q", got)
	}
}

func TestTraceKeepsOnlyFrameShapedLines(t *testing.T) {
	got := trace(strings.Join([]string{
		"at load (app://bundle.js:10:2)",
		"client-key-data: " + fakeClientKeyData,
		"main.go:42 +0x1f",
	}, "\n"))

	if strings.Contains(got, fakeClientKeyData) || strings.Contains(got, "client-key-data") {
		t.Fatalf("a non-frame line survived: %q", got)
	}
	if !strings.Contains(got, "main.go:42") {
		t.Fatalf("a frame was lost: %q", got)
	}
}

func TestResourcePathDropsQueriesAndUserInfo(t *testing.T) {
	got := resourcePath("https://admin:hunter2synthetic@cluster.example.com:6443/api/v1/pods?watch=true")

	if got != "https://cluster.example.com:6443/api/v1/pods" {
		t.Fatalf("unexpected path: %q", got)
	}
}
