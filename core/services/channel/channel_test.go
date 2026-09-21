package channel

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

func TestOpenSplitsStdoutAndStderrAndReportsStatus(t *testing.T) {
	status := `{"kind":"Status","status":"Success"}`

	server := newSocketServer(t, []string{testSubprotocol}, func(conn *websocket.Conn) {
		ctx := context.Background()
		_ = writeFrame(ctx, conn, channelStdout, []byte("out-ø"))
		_ = writeFrame(ctx, conn, channelStderr, []byte("err-ø"))
		_ = writeFrame(ctx, conn, channelStatus, []byte(status))
		_ = conn.Close(websocket.StatusNormalClosure, "")
	})

	service, registry, emitter := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	opened := service.Open(ChannelSpec{
		SessionId:    sessionId,
		Path:         "/anything?the=frontend&chose=it",
		Subprotocols: []string{testSubprotocol},
	})
	if !opened.Success {
		t.Fatalf("open failed: %s", opened.Error)
	}

	await(t, "the close event", func() bool {
		_, found := emitter.channelClose(opened.ChannelId)
		return found
	})

	stdout := emitter.data(opened.ChannelId, StreamStdout)
	if len(stdout) != 1 {
		t.Fatalf("expected one stdout event, got %d", len(stdout))
	}
	if decoded := decode(t, stdout[0].Data); decoded != "out-ø" {
		t.Fatalf("stdout carried %q", decoded)
	}

	stderr := emitter.data(opened.ChannelId, StreamStderr)
	if len(stderr) != 1 {
		t.Fatalf("expected one stderr event, got %d", len(stderr))
	}
	if decoded := decode(t, stderr[0].Data); decoded != "err-ø" {
		t.Fatalf("stderr carried %q", decoded)
	}

	closed, _ := emitter.channelClose(opened.ChannelId)
	if closed.Status != StatusEof {
		t.Fatalf("close status is %q", closed.Status)
	}
	if closed.Reason != status {
		t.Fatalf("close reason is %q", closed.Reason)
	}
}

func TestWriteReachesStdin(t *testing.T) {
	recorder := &frameRecorder{}

	server := newSocketServer(t, []string{testSubprotocol}, func(conn *websocket.Conn) {
		readUntilClosed(conn, recorder)
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	opened := service.Open(ChannelSpec{
		SessionId:    sessionId,
		Path:         "/exec",
		Subprotocols: []string{testSubprotocol},
	})
	if !opened.Success {
		t.Fatalf("open failed: %s", opened.Error)
	}

	written := service.Write(opened.ChannelId, base64.StdEncoding.EncodeToString([]byte("ls -la\n")))
	if !written.Success {
		t.Fatalf("write failed: %s", written.Error)
	}

	await(t, "the stdin frame", func() bool { return recorder.count() > 0 })

	frame := recorder.snapshot()[0]
	if frame[0] != channelStdin {
		t.Fatalf("frame arrived on channel %d", frame[0])
	}
	if string(frame[1:]) != "ls -la\n" {
		t.Fatalf("stdin carried %q", string(frame[1:]))
	}
}

func TestWriteRejectsInputThatIsNotBase64(t *testing.T) {
	server := newSocketServer(t, []string{testSubprotocol}, func(conn *websocket.Conn) {
		readUntilClosed(conn, &frameRecorder{})
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	opened := service.Open(ChannelSpec{
		SessionId:    sessionId,
		Path:         "/exec",
		Subprotocols: []string{testSubprotocol},
	})
	if !opened.Success {
		t.Fatalf("open failed: %s", opened.Error)
	}

	written := service.Write(opened.ChannelId, "not base64 at all")
	if written.Success {
		t.Fatal("write accepted input that is not base64")
	}
}

func TestResizeSendsTerminalSizeOnTheResizeChannel(t *testing.T) {
	recorder := &frameRecorder{}

	server := newSocketServer(t, []string{testSubprotocol}, func(conn *websocket.Conn) {
		readUntilClosed(conn, recorder)
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	opened := service.Open(ChannelSpec{
		SessionId:    sessionId,
		Path:         "/exec",
		Subprotocols: []string{testSubprotocol},
		Tty:          true,
		Cols:         120,
		Rows:         40,
	})
	if !opened.Success {
		t.Fatalf("open failed: %s", opened.Error)
	}

	await(t, "the initial resize frame", func() bool { return recorder.count() > 0 })

	initial := recorder.snapshot()[0]
	if initial[0] != channelResize {
		t.Fatalf("initial frame arrived on channel %d", initial[0])
	}
	if string(initial[1:]) != `{"Width":120,"Height":40}` {
		t.Fatalf("initial resize carried %q", string(initial[1:]))
	}

	resized := service.Resize(opened.ChannelId, 80, 24)
	if !resized.Success {
		t.Fatalf("resize failed: %s", resized.Error)
	}

	await(t, "the second resize frame", func() bool { return recorder.count() > 1 })

	second := recorder.snapshot()[1]
	if second[0] != channelResize {
		t.Fatalf("second frame arrived on channel %d", second[0])
	}
	if string(second[1:]) != `{"Width":80,"Height":24}` {
		t.Fatalf("second resize carried %q", string(second[1:]))
	}
}

func TestResizeRejectsSizesTheProtocolCannotCarry(t *testing.T) {
	server := newSocketServer(t, []string{testSubprotocol}, func(conn *websocket.Conn) {
		readUntilClosed(conn, &frameRecorder{})
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	opened := service.Open(ChannelSpec{
		SessionId:    sessionId,
		Path:         "/exec",
		Subprotocols: []string{testSubprotocol},
	})
	if !opened.Success {
		t.Fatalf("open failed: %s", opened.Error)
	}

	for _, size := range [][2]int{{0, 24}, {80, 0}, {70000, 24}, {-1, -1}} {
		result := service.Resize(opened.ChannelId, size[0], size[1])
		if result.Success {
			t.Fatalf("resize accepted %dx%d", size[0], size[1])
		}
	}
}

func TestOpenFailsWhenTheSubprotocolIsNotNegotiated(t *testing.T) {
	server := newSocketServer(t, nil, func(conn *websocket.Conn) {
		readUntilClosed(conn, &frameRecorder{})
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	results := make(chan ChannelResult, 1)
	go func() {
		results <- service.Open(ChannelSpec{
			SessionId:    sessionId,
			Path:         "/exec",
			Subprotocols: []string{testSubprotocol},
		})
	}()

	select {
	case opened := <-results:
		if opened.Success {
			t.Fatal("open succeeded without a negotiated subprotocol")
		}
		if !strings.Contains(opened.Error, "did not negotiate") || !strings.Contains(opened.Error, "1.30") {
			t.Fatalf("error does not explain the failure: %s", opened.Error)
		}
	case <-time.After(15 * time.Second):
		t.Fatal("open hung instead of reporting the failed negotiation")
	}
}

func TestOpenFailsWhenTheServerNeverAnswersTheHandshake(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
		<-request.Context().Done()
	}))
	t.Cleanup(server.Close)

	service, registry, _ := newTestService(t)
	sessionId := connectWithTimeout(t, registry, server, 2)

	results := make(chan ChannelResult, 1)
	go func() {
		results <- service.Open(ChannelSpec{
			SessionId:    sessionId,
			Path:         "/exec",
			Subprotocols: []string{testSubprotocol},
		})
	}()

	select {
	case opened := <-results:
		if opened.Success {
			t.Fatal("open succeeded against a server that never answered")
		}
	case <-time.After(20 * time.Second):
		t.Fatal("open hung instead of timing out the handshake")
	}
}

func TestOpenRejectsAnUnknownSession(t *testing.T) {
	service, _, _ := newTestService(t)

	opened := service.Open(ChannelSpec{SessionId: "nothing"})
	if opened.Success {
		t.Fatal("open succeeded for an unknown session")
	}
}

func TestChannelActionsRejectAnUnknownChannel(t *testing.T) {
	service, _, _ := newTestService(t)

	if service.Write("nothing", "").Success {
		t.Fatal("write succeeded for an unknown channel")
	}
	if service.Resize("nothing", 80, 24).Success {
		t.Fatal("resize succeeded for an unknown channel")
	}
	if service.Close("nothing").Success {
		t.Fatal("close succeeded for an unknown channel")
	}
}

func TestCloseEndsTheChannelAndLeavesNothingRunning(t *testing.T) {
	server := newSocketServer(t, []string{testSubprotocol}, func(conn *websocket.Conn) {
		readUntilClosed(conn, &frameRecorder{})
	})

	service, registry, emitter := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	baseline := runtime.NumGoroutine()

	opened := service.Open(ChannelSpec{
		SessionId:    sessionId,
		Path:         "/exec",
		Subprotocols: []string{testSubprotocol},
	})
	if !opened.Success {
		t.Fatalf("open failed: %s", opened.Error)
	}

	listed := service.Channels()
	if len(listed.Channels) != 1 || listed.Channels[0].Id != opened.ChannelId {
		t.Fatalf("channel is missing from the listing: %+v", listed.Channels)
	}

	closed := service.Close(opened.ChannelId)
	if !closed.Success {
		t.Fatalf("close failed: %s", closed.Error)
	}

	if remaining := service.Channels(); len(remaining.Channels) != 0 {
		t.Fatalf("channel survived the close: %+v", remaining.Channels)
	}

	event, found := emitter.channelClose(opened.ChannelId)
	if !found {
		t.Fatal("no close event was emitted")
	}
	if event.Status != StatusClosed {
		t.Fatalf("close status is %q", event.Status)
	}

	waitForGoroutines(t, baseline)
}

func TestDisconnectingTheSessionClosesItsChannels(t *testing.T) {
	server := newSocketServer(t, []string{testSubprotocol}, func(conn *websocket.Conn) {
		readUntilClosed(conn, &frameRecorder{})
	})

	service, registry, emitter := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	opened := service.Open(ChannelSpec{
		SessionId:    sessionId,
		Path:         "/exec",
		Subprotocols: []string{testSubprotocol},
	})
	if !opened.Success {
		t.Fatalf("open failed: %s", opened.Error)
	}

	registry.Remove(sessionId)

	await(t, "the close event after the session went away", func() bool {
		_, found := emitter.channelClose(opened.ChannelId)
		return found
	})
}

func TestServiceShutdownClosesEveryChannel(t *testing.T) {
	server := newSocketServer(t, []string{testSubprotocol}, func(conn *websocket.Conn) {
		readUntilClosed(conn, &frameRecorder{})
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	baseline := runtime.NumGoroutine()

	for range 3 {
		opened := service.Open(ChannelSpec{
			SessionId:    sessionId,
			Path:         "/exec",
			Subprotocols: []string{testSubprotocol},
		})
		if !opened.Success {
			t.Fatalf("open failed: %s", opened.Error)
		}
	}

	if err := service.ServiceShutdown(); err != nil {
		t.Fatalf("shutdown failed: %v", err)
	}

	if remaining := service.Channels(); len(remaining.Channels) != 0 {
		t.Fatalf("channels survived the shutdown: %+v", remaining.Channels)
	}

	waitForGoroutines(t, baseline)
}

func decode(t *testing.T, data string) string {
	t.Helper()

	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		t.Fatalf("event data is not base64: %v", err)
	}

	return string(decoded)
}
