package channel

import (
	"context"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"

	"iappx_k8s_admin/core/services/kube"
)

const testSubprotocol = "v5.channel.k8s.io"

type recordedEvent struct {
	name string
	data any
}

type recordingEmitter struct {
	mutex  sync.Mutex
	events []recordedEvent
}

func (e *recordingEmitter) Emit(name string, data any) {
	e.mutex.Lock()
	defer e.mutex.Unlock()

	e.events = append(e.events, recordedEvent{name: name, data: data})
}

func (e *recordingEmitter) snapshot() []recordedEvent {
	e.mutex.Lock()
	defer e.mutex.Unlock()

	return append([]recordedEvent(nil), e.events...)
}

func (e *recordingEmitter) data(channelId string, stream string) []ChannelDataEvent {
	var found []ChannelDataEvent
	for _, event := range e.snapshot() {
		payload, ok := event.data.(ChannelDataEvent)
		if event.name == EventChannelData && ok && payload.ChannelId == channelId && payload.Stream == stream {
			found = append(found, payload)
		}
	}

	return found
}

func (e *recordingEmitter) channelClose(channelId string) (ChannelCloseEvent, bool) {
	for _, event := range e.snapshot() {
		payload, ok := event.data.(ChannelCloseEvent)
		if event.name == EventChannelClose && ok && payload.ChannelId == channelId {
			return payload, true
		}
	}

	return ChannelCloseEvent{}, false
}

func (e *recordingEmitter) forwardErrors(forwardId string) []string {
	var messages []string
	for _, event := range e.snapshot() {
		payload, ok := event.data.(ForwardErrorEvent)
		if event.name == EventForwardError && ok && payload.ForwardId == forwardId {
			messages = append(messages, payload.Error)
		}
	}

	return messages
}

func (e *recordingEmitter) forwardClose(forwardId string) (ForwardCloseEvent, bool) {
	for _, event := range e.snapshot() {
		payload, ok := event.data.(ForwardCloseEvent)
		if event.name == EventForwardClose && ok && payload.ForwardId == forwardId {
			return payload, true
		}
	}

	return ForwardCloseEvent{}, false
}

func await(t *testing.T, reason string, condition func() bool) {
	t.Helper()

	deadline := time.Now().Add(10 * time.Second)
	for {
		if condition() {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", reason)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

type frameRecorder struct {
	mutex  sync.Mutex
	frames [][]byte
}

func (r *frameRecorder) add(frame []byte) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	r.frames = append(r.frames, append([]byte(nil), frame...))
}

func (r *frameRecorder) snapshot() [][]byte {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	return append([][]byte(nil), r.frames...)
}

func (r *frameRecorder) count() int {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	return len(r.frames)
}

func newTestService(t *testing.T) (*ChannelService, *kube.SessionRegistry, *recordingEmitter) {
	t.Helper()

	registry := kube.NewSessionRegistry()
	t.Cleanup(registry.Close)

	emitter := &recordingEmitter{}
	service := NewChannelService(registry)
	service.emitter = emitter
	t.Cleanup(func() { _ = service.ServiceShutdown() })

	return service, registry, emitter
}

func connectToServer(t *testing.T, registry *kube.SessionRegistry, server *httptest.Server) string {
	t.Helper()

	return connectWithTimeout(t, registry, server, 0)
}

func connectWithTimeout(t *testing.T, registry *kube.SessionRegistry, server *httptest.Server, seconds int) string {
	t.Helper()

	result := kube.NewConnectionService(registry).Connect(kube.ConnectionSpec{
		Server:         server.URL,
		CaPem:          encodePem("CERTIFICATE", server.Certificate().Raw),
		TimeoutSeconds: seconds,
	})
	if !result.Success {
		t.Fatalf("connect failed: %s", result.Error)
	}

	return result.SessionId
}

func newSocketServer(t *testing.T, subprotocols []string, serve func(*websocket.Conn)) *httptest.Server {
	t.Helper()

	// httptest forgets a hijacked connection, so closing the server would leave
	// an open socket behind: every accepted one is kept for the teardown.
	var (
		mutex sync.Mutex
		conns []*websocket.Conn
	)

	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		conn, err := websocket.Accept(writer, request, &websocket.AcceptOptions{Subprotocols: subprotocols})
		if err != nil {
			return
		}

		mutex.Lock()
		conns = append(conns, conn)
		mutex.Unlock()

		defer conn.CloseNow()

		serve(conn)
	}))

	t.Cleanup(func() {
		mutex.Lock()
		open := append([]*websocket.Conn(nil), conns...)
		mutex.Unlock()

		for _, conn := range open {
			conn.CloseNow()
		}

		server.Close()
	})

	return server
}

func readUntilClosed(conn *websocket.Conn, recorder *frameRecorder) {
	for {
		_, message, err := conn.Read(context.Background())
		if err != nil {
			return
		}
		recorder.add(message)
	}
}

func waitForGoroutines(t *testing.T, baseline int) {
	t.Helper()

	deadline := time.Now().Add(10 * time.Second)
	for {
		current := runtime.NumGoroutine()
		if current <= baseline+2 {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("goroutines leaked: %d at start, %d after shutdown", baseline, current)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func encodePem(blockType string, der []byte) string {
	return string(pem.EncodeToMemory(&pem.Block{Type: blockType, Bytes: der}))
}
