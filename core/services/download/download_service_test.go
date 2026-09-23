package download

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"testing"
	"time"
)

const eventTimeout = 10 * time.Second

type recorder struct {
	mu       sync.Mutex
	progress []ProgressEvent
	done     chan DoneEvent
}

func newRecordedService() (*DownloadService, *recorder) {
	service := NewDownloadService()
	sink := &recorder{done: make(chan DoneEvent, 4)}
	service.emit = sink.record

	return service, sink
}

func (r *recorder) record(name string, payload any) {
	switch typed := payload.(type) {
	case ProgressEvent:
		r.mu.Lock()
		r.progress = append(r.progress, typed)
		r.mu.Unlock()
	case DoneEvent:
		r.done <- typed
	}
}

func (r *recorder) awaitDone(t *testing.T) DoneEvent {
	t.Helper()

	select {
	case event := <-r.done:
		return event
	case <-time.After(eventTimeout):
		t.Fatal("download never finished")
		return DoneEvent{}
	}
}

func (r *recorder) lastProgress(t *testing.T) ProgressEvent {
	t.Helper()

	r.mu.Lock()
	defer r.mu.Unlock()

	if len(r.progress) == 0 {
		t.Fatal("no progress was reported")
	}

	return r.progress[len(r.progress)-1]
}

func payload() []byte {
	return bytes.Repeat([]byte("kubiq-release-asset;"), 50_000)
}

func digestOf(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func TestStartWritesTheFileAndReportsItsDigest(t *testing.T) {
	body := payload()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", strconv.Itoa(len(body)))
		w.Write(body)
	}))
	defer server.Close()

	service, sink := newRecordedService()
	target := filepath.Join(t.TempDir(), "updates", "installer.exe")

	started := service.Start(DownloadSpec{Url: server.URL, Path: target})
	if !started.Success {
		t.Fatalf("start failed: %s", started.Error)
	}

	done := sink.awaitDone(t)
	if !done.Success {
		t.Fatalf("download failed: %s", done.Error)
	}
	if done.DownloadId != started.DownloadId {
		t.Fatalf("done event carries %q, want %q", done.DownloadId, started.DownloadId)
	}
	if done.Sha256 != digestOf(body) {
		t.Fatalf("sha256 = %s, want %s", done.Sha256, digestOf(body))
	}
	if done.Size != int64(len(body)) {
		t.Fatalf("size = %d, want %d", done.Size, len(body))
	}

	written, err := os.ReadFile(target)
	if err != nil {
		t.Fatalf("read target: %v", err)
	}
	if !bytes.Equal(written, body) {
		t.Fatal("the file on disk differs from what the server sent")
	}

	last := sink.lastProgress(t)
	if last.Received != int64(len(body)) || last.Total != int64(len(body)) {
		t.Fatalf("last progress = %d/%d, want %d/%d", last.Received, last.Total, len(body), len(body))
	}
}

func TestStartPassesTheCallerHeaders(t *testing.T) {
	var accept string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		accept = r.Header.Get("Accept")
		w.Write([]byte("ok"))
	}))
	defer server.Close()

	service, sink := newRecordedService()
	service.Start(DownloadSpec{
		Url:     server.URL,
		Path:    filepath.Join(t.TempDir(), "file"),
		Headers: map[string]string{"Accept": "application/octet-stream"},
	})

	if done := sink.awaitDone(t); !done.Success {
		t.Fatalf("download failed: %s", done.Error)
	}
	if accept != "application/octet-stream" {
		t.Fatalf("Accept = %q, want application/octet-stream", accept)
	}
}

func TestStartReportsAFailureStatusAndLeavesNothingBehind(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "gone", http.StatusNotFound)
	}))
	defer server.Close()

	service, sink := newRecordedService()
	dir := t.TempDir()
	target := filepath.Join(dir, "file")

	service.Start(DownloadSpec{Url: server.URL, Path: target})

	done := sink.awaitDone(t)
	if done.Success || done.Error == "" {
		t.Fatalf("done = %+v, want a failure with a message", done)
	}

	entries, _ := os.ReadDir(dir)
	if len(entries) != 0 {
		t.Fatalf("the failed download left %d files behind", len(entries))
	}
}

func TestCancelStopsTheDownloadAndRemovesThePartialFile(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "1000000")
		w.Write([]byte("first chunk"))
		w.(http.Flusher).Flush()
		select {
		case <-release:
		case <-r.Context().Done():
		}
	}))
	defer server.Close()
	defer close(release)

	service, sink := newRecordedService()
	dir := t.TempDir()

	started := service.Start(DownloadSpec{Url: server.URL, Path: filepath.Join(dir, "file")})

	deadline := time.Now().Add(eventTimeout)
	for {
		sink.mu.Lock()
		reported := len(sink.progress)
		sink.mu.Unlock()
		if reported > 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("no progress before cancelling")
		}
		time.Sleep(10 * time.Millisecond)
	}

	if result := service.Cancel(started.DownloadId); !result.Success {
		t.Fatalf("cancel failed: %s", result.Error)
	}

	done := sink.awaitDone(t)
	if !done.Cancelled || done.Success {
		t.Fatalf("done = %+v, want a cancelled download", done)
	}

	entries, _ := os.ReadDir(dir)
	if len(entries) != 0 {
		t.Fatalf("the cancelled download left %d files behind", len(entries))
	}
}

func TestCancelOfAnUnknownDownloadFails(t *testing.T) {
	service, _ := newRecordedService()

	if result := service.Cancel("d404"); result.Success {
		t.Fatal("cancel of an unknown download succeeded")
	}
}

func TestStartRejectsAnEmptySpec(t *testing.T) {
	service, _ := newRecordedService()

	if result := service.Start(DownloadSpec{Path: "file"}); result.Success {
		t.Fatal("start without a url succeeded")
	}
	if result := service.Start(DownloadSpec{Url: "http://127.0.0.1"}); result.Success {
		t.Fatal("start without a path succeeded")
	}
}
