package process

import (
	"encoding/base64"
	"strings"
	"sync"
	"testing"
	"time"
)

const eventTimeout = 20 * time.Second

type recordedEvent struct {
	name string
	id   string
	data string
	code int
}

type recorder struct {
	mu     sync.Mutex
	events []recordedEvent
}

func newRecordedService() (*ProcessService, *recorder) {
	service := NewProcessService()
	sink := &recorder{}
	service.emit = sink.record

	return service, sink
}

func (r *recorder) record(name string, payload any) {
	r.mu.Lock()
	defer r.mu.Unlock()

	switch typed := payload.(type) {
	case StreamEvent:
		r.events = append(r.events, recordedEvent{name: name, id: typed.ProcessId, data: typed.Data})
	case ExitEvent:
		r.events = append(r.events, recordedEvent{name: name, id: typed.ProcessId, code: typed.Code})
	}
}

func (r *recorder) stream(t *testing.T, name string, id string) (string, int) {
	t.Helper()

	r.mu.Lock()
	defer r.mu.Unlock()

	var builder strings.Builder
	chunks := 0

	for _, event := range r.events {
		if event.name != name || event.id != id {
			continue
		}

		decoded, err := base64.StdEncoding.DecodeString(event.data)
		if err != nil {
			t.Fatalf("chunk of %s is not base64: %v", id, err)
		}

		builder.Write(decoded)
		chunks++
	}

	return builder.String(), chunks
}

func (r *recorder) exits(id string) []int {
	r.mu.Lock()
	defer r.mu.Unlock()

	codes := make([]int, 0, 1)
	for _, event := range r.events {
		if event.name == EventExit && event.id == id {
			codes = append(codes, event.code)
		}
	}

	return codes
}

func (r *recorder) awaitExit(t *testing.T, id string) int {
	t.Helper()

	r.await(t, func() bool { return len(r.exits(id)) > 0 }, "exit event for "+id)

	return r.exits(id)[0]
}

func (r *recorder) awaitOutput(t *testing.T, id string, marker string) string {
	t.Helper()

	r.await(t, func() bool {
		output, _ := r.stream(t, EventStdout, id)
		return strings.Contains(output, marker)
	}, "marker "+marker+" on stdout of "+id)

	output, _ := r.stream(t, EventStdout, id)

	return output
}

func (r *recorder) await(t *testing.T, condition func() bool, what string) bool {
	t.Helper()

	deadline := time.Now().Add(eventTimeout)
	for time.Now().Before(deadline) {
		if condition() {
			return true
		}
		time.Sleep(5 * time.Millisecond)
	}

	t.Fatalf("timed out waiting for %s", what)

	return false
}
