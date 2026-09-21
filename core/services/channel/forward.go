package channel

import (
	"context"
	"encoding/binary"
	"fmt"
	"net"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"

	"iappx_k8s_admin/core/services/kube"
)

const (
	forwardData     = 0
	forwardError    = 1
	portPrefixBytes = 2

	defaultLocalAddress = "127.0.0.1"
	forwardChunkBytes   = 32 * 1024
)

type forwardHandle struct {
	id           string
	sessionId    string
	path         string
	subprotocols []string
	headers      map[string]string
	localAddress string
	localPort    int
	remotePort   int
	startedAt    time.Time
	session      *kube.Session
	listener     net.Listener
	ctx          context.Context
	cancel       context.CancelFunc
	done         chan struct{}
	connections  atomic.Int64
	group        sync.WaitGroup
}

func (s *ChannelService) StartForward(spec PortForwardSpec) (result PortForwardResult) {
	defer func() {
		if recovered := recover(); recovered != nil {
			result = PortForwardResult{Error: fmt.Sprintf("forward failed: %v", recovered)}
		}
	}()

	session, found := s.registry.Get(spec.SessionId)
	if !found {
		return PortForwardResult{Error: "unknown session: " + spec.SessionId}
	}

	if spec.RemotePort <= 0 || spec.RemotePort > maxPortNumber {
		return PortForwardResult{Error: fmt.Sprintf("remote port is out of range: %d", spec.RemotePort)}
	}
	if spec.LocalPort < 0 || spec.LocalPort > maxPortNumber {
		return PortForwardResult{Error: fmt.Sprintf("local port is out of range: %d", spec.LocalPort)}
	}

	address := strings.TrimSpace(spec.LocalAddress)
	if address == "" {
		address = defaultLocalAddress
	}

	if err := s.reserveForward(); err != nil {
		return PortForwardResult{Error: err.Error()}
	}

	listener, err := net.Listen("tcp", net.JoinHostPort(address, strconv.Itoa(spec.LocalPort)))
	if err != nil {
		s.abandonForward()
		return PortForwardResult{Error: err.Error()}
	}

	ctx, cancel := context.WithCancel(session.Context())
	handle := &forwardHandle{
		id:           newID(),
		sessionId:    session.ID,
		path:         spec.Path,
		subprotocols: spec.Subprotocols,
		headers:      spec.Headers,
		localAddress: address,
		localPort:    boundPort(listener, spec.LocalPort),
		remotePort:   spec.RemotePort,
		startedAt:    time.Now(),
		session:      session,
		listener:     listener,
		ctx:          ctx,
		cancel:       cancel,
		done:         make(chan struct{}),
	}

	s.addForward(handle)

	go s.acceptForward(handle)

	return PortForwardResult{Success: true, ForwardId: handle.id, LocalPort: handle.localPort}
}

func (s *ChannelService) StopForward(forwardId string) ChannelActionResult {
	handle, found := s.forward(forwardId)
	if !found {
		return ChannelActionResult{Error: "unknown forward: " + forwardId}
	}

	s.stopForward(handle)

	return ChannelActionResult{Success: true}
}

func (s *ChannelService) Forwards() ForwardsResult {
	handles := s.listForwards()

	slices.SortFunc(handles, func(left *forwardHandle, right *forwardHandle) int {
		if left.startedAt.Equal(right.startedAt) {
			return strings.Compare(left.id, right.id)
		}
		return left.startedAt.Compare(right.startedAt)
	})

	infos := make([]ForwardInfo, 0, len(handles))
	for _, handle := range handles {
		infos = append(infos, ForwardInfo{
			Id:           handle.id,
			SessionId:    handle.sessionId,
			LocalAddress: handle.localAddress,
			LocalPort:    handle.localPort,
			RemotePort:   handle.remotePort,
			Connections:  int(handle.connections.Load()),
		})
	}

	return ForwardsResult{Success: true, Forwards: infos}
}

func (s *ChannelService) stopForward(handle *forwardHandle) {
	handle.cancel()
	// Closing the listener is what unblocks Accept, and it frees the port before
	// the open connections have finished draining.
	_ = handle.listener.Close()

	awaitDone(handle.done)
}

func (s *ChannelService) stopAllForwards() {
	handles := s.listForwards()

	for _, handle := range handles {
		handle.cancel()
		_ = handle.listener.Close()
	}
	for _, handle := range handles {
		awaitDone(handle.done)
	}
}

func (s *ChannelService) acceptForward(handle *forwardHandle) {
	defer close(handle.done)

	status := s.accept(handle)

	handle.cancel()
	_ = handle.listener.Close()
	handle.group.Wait()
	s.removeForward(handle.id)

	s.emitter.Emit(EventForwardClose, ForwardCloseEvent{ForwardId: handle.id, Status: status})
}

func (s *ChannelService) accept(handle *forwardHandle) string {
	for {
		local, err := handle.listener.Accept()
		if err != nil {
			if handle.ctx.Err() != nil {
				return StatusClosed
			}
			s.emitForwardError(handle, err.Error())
			return StatusError
		}

		handle.group.Add(1)
		go func() {
			defer handle.group.Done()
			s.serveForward(handle, local)
		}()
	}
}

func (s *ChannelService) serveForward(handle *forwardHandle, local net.Conn) {
	defer local.Close()

	handle.connections.Add(1)
	defer handle.connections.Add(-1)

	ctx, cancel := context.WithCancel(handle.ctx)
	defer cancel()

	conn, err := dial(ctx, handle.session, handle.path, handle.subprotocols, handle.headers)
	if err != nil {
		s.emitForwardError(handle, err.Error())
		return
	}
	defer conn.CloseNow()

	// The port the connection is meant to reach is announced in the first two
	// bytes of the first data frame, the way the server announces it back.
	if err := writeFrame(ctx, conn, forwardData, portPrefix(handle.remotePort)); err != nil {
		s.emitForwardError(handle, err.Error())
		return
	}

	group := sync.WaitGroup{}
	group.Add(1)
	go func() {
		defer group.Done()
		defer cancel()
		pumpToRemote(ctx, conn, local)
	}()

	s.pumpToLocal(ctx, handle, conn, local)

	cancel()
	// A blocked local read only ends when its socket goes away.
	_ = local.Close()
	group.Wait()
}

func pumpToRemote(ctx context.Context, conn *websocket.Conn, local net.Conn) {
	buffer := make([]byte, forwardChunkBytes)

	for {
		read, err := local.Read(buffer)
		if read > 0 {
			if writeErr := writeFrame(ctx, conn, forwardData, buffer[:read]); writeErr != nil {
				return
			}
		}
		if err != nil {
			return
		}
	}
}

func (s *ChannelService) pumpToLocal(
	ctx context.Context,
	handle *forwardHandle,
	conn *websocket.Conn,
	local net.Conn,
) {
	dataPrefixPending := true
	errorPrefixPending := true

	for {
		_, message, err := conn.Read(ctx)
		if err != nil {
			if ctx.Err() == nil && !isNormalClose(err) {
				s.emitForwardError(handle, err.Error())
			}
			return
		}
		if len(message) == 0 {
			continue
		}

		payload := message[1:]

		switch message[0] {
		case forwardData:
			if dataPrefixPending {
				dataPrefixPending = false
				payload = trimPortPrefix(payload, handle.remotePort)
			}
			if len(payload) > 0 {
				if _, err := local.Write(payload); err != nil {
					return
				}
			}
		case forwardError:
			if errorPrefixPending {
				errorPrefixPending = false
				payload = trimPortPrefix(payload, handle.remotePort)
			}
			if len(payload) > 0 {
				s.emitForwardError(handle, string(payload))
			}
		}
	}
}

func (s *ChannelService) emitForwardError(handle *forwardHandle, message string) {
	s.emitter.Emit(EventForwardError, ForwardErrorEvent{ForwardId: handle.id, Error: message})
}

func portPrefix(port int) []byte {
	prefix := make([]byte, portPrefixBytes)
	binary.LittleEndian.PutUint16(prefix, uint16(port))

	return prefix
}

func trimPortPrefix(payload []byte, port int) []byte {
	// The server opens each channel by announcing the port; anything else in
	// that first frame is payload already.
	if len(payload) >= portPrefixBytes && int(binary.LittleEndian.Uint16(payload)) == port {
		return payload[portPrefixBytes:]
	}

	return payload
}

func boundPort(listener net.Listener, requested int) int {
	if address, ok := listener.Addr().(*net.TCPAddr); ok {
		return address.Port
	}

	return requested
}
