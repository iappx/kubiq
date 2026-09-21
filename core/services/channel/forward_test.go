package channel

import (
	"bytes"
	"context"
	"io"
	"net"
	"net/http/httptest"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

const testRemotePort = 8443

func newForwardServer(t *testing.T, remotePort int, opening *frameRecorder, reply func([]byte) []byte) *httptest.Server {
	t.Helper()

	// A real server announces the port on both channels of the pair, error
	// channel included.
	return newSocketServer(t, []string{testSubprotocol}, func(conn *websocket.Conn) {
		ctx := context.Background()
		prefix := portPrefix(remotePort)

		if err := writeFrame(ctx, conn, forwardData, prefix); err != nil {
			return
		}
		if err := writeFrame(ctx, conn, forwardError, prefix); err != nil {
			return
		}

		announced := false
		for {
			_, message, err := conn.Read(ctx)
			if err != nil {
				return
			}
			if len(message) == 0 || message[0] != forwardData {
				continue
			}

			payload := message[1:]
			if !announced {
				announced = true
				opening.add(payload)
				continue
			}

			if answer := reply(payload); len(answer) > 0 {
				if err := writeFrame(ctx, conn, forwardData, answer); err != nil {
					return
				}
			}
		}
	})
}

func TestForwardCarriesBytesBothWays(t *testing.T) {
	opening := &frameRecorder{}
	server := newForwardServer(t, testRemotePort, opening, bytes.ToUpper)

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	started := service.StartForward(PortForwardSpec{
		SessionId:    sessionId,
		Path:         "/whatever?the=frontend&built=it",
		Subprotocols: []string{testSubprotocol},
		RemotePort:   testRemotePort,
	})
	if !started.Success {
		t.Fatalf("start failed: %s", started.Error)
	}
	if started.LocalPort <= 0 {
		t.Fatalf("no local port was chosen: %d", started.LocalPort)
	}

	local := dialLocal(t, started.LocalPort)

	if _, err := local.Write([]byte("ping")); err != nil {
		t.Fatalf("write to the local port: %v", err)
	}

	answer := readLocal(t, local, 4)
	if answer != "PING" {
		t.Fatalf("local side received %q", answer)
	}

	await(t, "the announced port", func() bool { return opening.count() > 0 })

	if announced := opening.snapshot()[0]; !bytes.Equal(announced, portPrefix(testRemotePort)) {
		t.Fatalf("the first data frame carried %v, not the port prefix", announced)
	}

	forwards := service.Forwards()
	if len(forwards.Forwards) != 1 {
		t.Fatalf("expected one forward, got %+v", forwards.Forwards)
	}
	if forwards.Forwards[0].Connections != 1 {
		t.Fatalf("connection count is %d", forwards.Forwards[0].Connections)
	}
	if forwards.Forwards[0].LocalAddress != defaultLocalAddress {
		t.Fatalf("local address is %q", forwards.Forwards[0].LocalAddress)
	}
	if forwards.Forwards[0].RemotePort != testRemotePort {
		t.Fatalf("remote port is %d", forwards.Forwards[0].RemotePort)
	}

	_ = local.Close()
}

func TestForwardStripsThePortPrefixFromTheStream(t *testing.T) {
	opening := &frameRecorder{}
	server := newForwardServer(t, testRemotePort, opening, func(payload []byte) []byte {
		return append([]byte("echo:"), payload...)
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	started := service.StartForward(PortForwardSpec{
		SessionId:    sessionId,
		Path:         "/portforward",
		Subprotocols: []string{testSubprotocol},
		RemotePort:   testRemotePort,
	})
	if !started.Success {
		t.Fatalf("start failed: %s", started.Error)
	}

	local := dialLocal(t, started.LocalPort)
	defer local.Close()

	if _, err := local.Write([]byte("x")); err != nil {
		t.Fatalf("write to the local port: %v", err)
	}

	if answer := readLocal(t, local, len("echo:x")); answer != "echo:x" {
		t.Fatalf("the port prefix leaked into the stream: %q", answer)
	}
}

func TestStopForwardReleasesTheLocalPort(t *testing.T) {
	opening := &frameRecorder{}
	server := newForwardServer(t, testRemotePort, opening, bytes.ToUpper)

	service, registry, emitter := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	baseline := runtime.NumGoroutine()

	started := service.StartForward(PortForwardSpec{
		SessionId:    sessionId,
		Path:         "/portforward",
		Subprotocols: []string{testSubprotocol},
		RemotePort:   testRemotePort,
	})
	if !started.Success {
		t.Fatalf("start failed: %s", started.Error)
	}

	local := dialLocal(t, started.LocalPort)
	if _, err := local.Write([]byte("ping")); err != nil {
		t.Fatalf("write to the local port: %v", err)
	}
	if answer := readLocal(t, local, 4); answer != "PING" {
		t.Fatalf("local side received %q", answer)
	}

	stopped := service.StopForward(started.ForwardId)
	if !stopped.Success {
		t.Fatalf("stop failed: %s", stopped.Error)
	}

	if remaining := service.Forwards(); len(remaining.Forwards) != 0 {
		t.Fatalf("forward survived the stop: %+v", remaining.Forwards)
	}

	event, found := emitter.forwardClose(started.ForwardId)
	if !found {
		t.Fatal("no close event was emitted")
	}
	if event.Status != StatusClosed {
		t.Fatalf("close status is %q", event.Status)
	}

	rebound, err := net.Listen("tcp", net.JoinHostPort(defaultLocalAddress, strconv.Itoa(started.LocalPort)))
	if err != nil {
		t.Fatalf("the local port is still taken: %v", err)
	}
	_ = rebound.Close()

	_ = local.Close()

	waitForGoroutines(t, baseline)
}

func TestStopForwardEndsOpenConnections(t *testing.T) {
	opening := &frameRecorder{}
	server := newForwardServer(t, testRemotePort, opening, bytes.ToUpper)

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	started := service.StartForward(PortForwardSpec{
		SessionId:    sessionId,
		Path:         "/portforward",
		Subprotocols: []string{testSubprotocol},
		RemotePort:   testRemotePort,
	})
	if !started.Success {
		t.Fatalf("start failed: %s", started.Error)
	}

	local := dialLocal(t, started.LocalPort)
	defer local.Close()

	if _, err := local.Write([]byte("ping")); err != nil {
		t.Fatalf("write to the local port: %v", err)
	}
	if answer := readLocal(t, local, 4); answer != "PING" {
		t.Fatalf("local side received %q", answer)
	}

	if stopped := service.StopForward(started.ForwardId); !stopped.Success {
		t.Fatalf("stop failed: %s", stopped.Error)
	}

	_ = local.SetReadDeadline(time.Now().Add(10 * time.Second))
	if _, err := local.Read(make([]byte, 1)); err == nil {
		t.Fatal("the local connection survived the stop")
	}
}

func TestStartForwardReportsAPortThatIsAlreadyTaken(t *testing.T) {
	opening := &frameRecorder{}
	server := newForwardServer(t, testRemotePort, opening, bytes.ToUpper)

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	taken, err := net.Listen("tcp", net.JoinHostPort(defaultLocalAddress, "0"))
	if err != nil {
		t.Fatalf("take a port: %v", err)
	}
	defer taken.Close()

	started := service.StartForward(PortForwardSpec{
		SessionId:    sessionId,
		Path:         "/portforward",
		Subprotocols: []string{testSubprotocol},
		LocalPort:    taken.Addr().(*net.TCPAddr).Port,
		RemotePort:   testRemotePort,
	})
	if started.Success {
		t.Fatal("start succeeded on a port that is already taken")
	}
	if started.Error == "" {
		t.Fatal("start reported no reason")
	}
}

func TestStartForwardRejectsPortsOutsideTheProtocolRange(t *testing.T) {
	opening := &frameRecorder{}
	server := newForwardServer(t, testRemotePort, opening, bytes.ToUpper)

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	for _, spec := range []PortForwardSpec{
		{SessionId: sessionId, RemotePort: 0},
		{SessionId: sessionId, RemotePort: 70000},
		{SessionId: sessionId, RemotePort: testRemotePort, LocalPort: -1},
	} {
		if result := service.StartForward(spec); result.Success {
			t.Fatalf("start accepted %+v", spec)
		}
	}
}

func TestForwardReportsAServerThatRefusesTheSubprotocol(t *testing.T) {
	server := newSocketServer(t, nil, func(conn *websocket.Conn) {
		readUntilClosed(conn, &frameRecorder{})
	})

	service, registry, emitter := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	started := service.StartForward(PortForwardSpec{
		SessionId:    sessionId,
		Path:         "/portforward",
		Subprotocols: []string{testSubprotocol},
		RemotePort:   testRemotePort,
	})
	if !started.Success {
		t.Fatalf("start failed: %s", started.Error)
	}

	local := dialLocal(t, started.LocalPort)
	defer local.Close()

	await(t, "the forward error event", func() bool {
		return len(emitter.forwardErrors(started.ForwardId)) > 0
	})

	if message := emitter.forwardErrors(started.ForwardId)[0]; !strings.Contains(message, "did not negotiate") {
		t.Fatalf("error does not explain the failure: %s", message)
	}
}

func TestForwardReportsWhatTheErrorChannelCarries(t *testing.T) {
	server := newSocketServer(t, []string{testSubprotocol}, func(conn *websocket.Conn) {
		ctx := context.Background()
		prefix := portPrefix(testRemotePort)

		_ = writeFrame(ctx, conn, forwardData, prefix)
		_ = writeFrame(ctx, conn, forwardError, prefix)
		_ = writeFrame(ctx, conn, forwardError, []byte("error forwarding port 8443"))

		readUntilClosed(conn, &frameRecorder{})
	})

	service, registry, emitter := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	started := service.StartForward(PortForwardSpec{
		SessionId:    sessionId,
		Path:         "/portforward",
		Subprotocols: []string{testSubprotocol},
		RemotePort:   testRemotePort,
	})
	if !started.Success {
		t.Fatalf("start failed: %s", started.Error)
	}

	local := dialLocal(t, started.LocalPort)
	defer local.Close()

	await(t, "the forward error event", func() bool {
		return len(emitter.forwardErrors(started.ForwardId)) > 0
	})

	if message := emitter.forwardErrors(started.ForwardId)[0]; message != "error forwarding port 8443" {
		t.Fatalf("the error channel arrived as %q", message)
	}
}

func TestStartForwardRejectsAnUnknownSession(t *testing.T) {
	service, _, _ := newTestService(t)

	if service.StartForward(PortForwardSpec{SessionId: "nothing", RemotePort: 80}).Success {
		t.Fatal("start succeeded for an unknown session")
	}
	if service.StopForward("nothing").Success {
		t.Fatal("stop succeeded for an unknown forward")
	}
}

func TestServiceShutdownStopsEveryForward(t *testing.T) {
	opening := &frameRecorder{}
	server := newForwardServer(t, testRemotePort, opening, bytes.ToUpper)

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	baseline := runtime.NumGoroutine()

	ports := make([]int, 0, 3)
	for range 3 {
		started := service.StartForward(PortForwardSpec{
			SessionId:    sessionId,
			Path:         "/portforward",
			Subprotocols: []string{testSubprotocol},
			RemotePort:   testRemotePort,
		})
		if !started.Success {
			t.Fatalf("start failed: %s", started.Error)
		}
		ports = append(ports, started.LocalPort)
	}

	if err := service.ServiceShutdown(); err != nil {
		t.Fatalf("shutdown failed: %v", err)
	}

	if remaining := service.Forwards(); len(remaining.Forwards) != 0 {
		t.Fatalf("forwards survived the shutdown: %+v", remaining.Forwards)
	}

	for _, port := range ports {
		rebound, err := net.Listen("tcp", net.JoinHostPort(defaultLocalAddress, strconv.Itoa(port)))
		if err != nil {
			t.Fatalf("port %d is still taken: %v", port, err)
		}
		_ = rebound.Close()
	}

	waitForGoroutines(t, baseline)
}

func dialLocal(t *testing.T, port int) net.Conn {
	t.Helper()

	local, err := net.DialTimeout("tcp", net.JoinHostPort(defaultLocalAddress, strconv.Itoa(port)), 10*time.Second)
	if err != nil {
		t.Fatalf("dial the local port: %v", err)
	}
	t.Cleanup(func() { _ = local.Close() })

	return local
}

func readLocal(t *testing.T, local net.Conn, size int) string {
	t.Helper()

	if err := local.SetReadDeadline(time.Now().Add(10 * time.Second)); err != nil {
		t.Fatalf("set a read deadline: %v", err)
	}

	buffer := make([]byte, size)
	if _, err := io.ReadFull(local, buffer); err != nil {
		t.Fatalf("read from the local port: %v", err)
	}

	return string(buffer)
}
