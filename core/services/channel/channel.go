package channel

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
)

const (
	channelStdin  = 0
	channelStdout = 1
	channelStderr = 2
	channelStatus = 3
	channelResize = 4
)

// The protocol carries a terminal size as two uint16 fields.
const maxTerminalSize = 65535

type terminalSize struct {
	Width  int `json:"Width"`
	Height int `json:"Height"`
}

type channelHandle struct {
	id        string
	sessionId string
	path      string
	tty       bool
	startedAt time.Time
	conn      *websocket.Conn
	ctx       context.Context
	cancel    context.CancelFunc
	done      chan struct{}

	writeMutex sync.Mutex
}

func (h *channelHandle) send(frame byte, payload []byte) error {
	h.writeMutex.Lock()
	defer h.writeMutex.Unlock()

	return writeFrame(h.ctx, h.conn, frame, payload)
}

func (h *channelHandle) resize(cols int, rows int) error {
	payload, err := json.Marshal(terminalSize{Width: cols, Height: rows})
	if err != nil {
		return err
	}

	return h.send(channelResize, payload)
}

func (s *ChannelService) Open(spec ChannelSpec) (result ChannelResult) {
	// A panic inside a bound method takes the whole application down, so the
	// entry point turns one into an ordinary failed result.
	defer func() {
		if recovered := recover(); recovered != nil {
			result = ChannelResult{Error: fmt.Sprintf("channel failed: %v", recovered)}
		}
	}()

	session, found := s.registry.Get(spec.SessionId)
	if !found {
		return ChannelResult{Error: "unknown session: " + spec.SessionId}
	}

	if err := s.reserveChannel(); err != nil {
		return ChannelResult{Error: err.Error()}
	}

	ctx, cancel := context.WithCancel(session.Context())

	conn, err := dial(ctx, session, spec.Path, spec.Subprotocols, spec.Headers)
	if err != nil {
		cancel()
		s.abandonChannel()
		return ChannelResult{Error: err.Error()}
	}

	handle := &channelHandle{
		id:        newID(),
		sessionId: session.ID,
		path:      spec.Path,
		tty:       spec.Tty,
		startedAt: time.Now(),
		conn:      conn,
		ctx:       ctx,
		cancel:    cancel,
		done:      make(chan struct{}),
	}

	if spec.Tty && isTerminalSize(spec.Cols) && isTerminalSize(spec.Rows) {
		if err := handle.resize(spec.Cols, spec.Rows); err != nil {
			conn.CloseNow()
			cancel()
			s.abandonChannel()
			return ChannelResult{Error: err.Error()}
		}
	}

	s.addChannel(handle)

	go s.readChannel(handle)

	return ChannelResult{Success: true, ChannelId: handle.id}
}

func (s *ChannelService) Write(channelId string, data string) ChannelActionResult {
	handle, found := s.channel(channelId)
	if !found {
		return ChannelActionResult{Error: "unknown channel: " + channelId}
	}

	payload, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return ChannelActionResult{Error: "channel input is not valid base64"}
	}

	if err := handle.send(channelStdin, payload); err != nil {
		return ChannelActionResult{Error: err.Error()}
	}

	return ChannelActionResult{Success: true}
}

func (s *ChannelService) Resize(channelId string, cols int, rows int) ChannelActionResult {
	handle, found := s.channel(channelId)
	if !found {
		return ChannelActionResult{Error: "unknown channel: " + channelId}
	}

	if !isTerminalSize(cols) || !isTerminalSize(rows) {
		return ChannelActionResult{Error: fmt.Sprintf("terminal size is out of range: %dx%d", cols, rows)}
	}

	if err := handle.resize(cols, rows); err != nil {
		return ChannelActionResult{Error: err.Error()}
	}

	return ChannelActionResult{Success: true}
}

func (s *ChannelService) Close(channelId string) ChannelActionResult {
	handle, found := s.channel(channelId)
	if !found {
		return ChannelActionResult{Error: "unknown channel: " + channelId}
	}

	handle.cancel()
	awaitDone(handle.done)

	return ChannelActionResult{Success: true}
}

func (s *ChannelService) Channels() ChannelsResult {
	handles := s.listChannels()

	slices.SortFunc(handles, func(left *channelHandle, right *channelHandle) int {
		if left.startedAt.Equal(right.startedAt) {
			return strings.Compare(left.id, right.id)
		}
		return left.startedAt.Compare(right.startedAt)
	})

	infos := make([]ChannelInfo, 0, len(handles))
	for _, handle := range handles {
		infos = append(infos, ChannelInfo{
			Id:        handle.id,
			SessionId: handle.sessionId,
			Path:      handle.path,
			Tty:       handle.tty,
			StartedAt: handle.startedAt.UTC().Format(time.RFC3339),
		})
	}

	return ChannelsResult{Success: true, Channels: infos}
}

func (s *ChannelService) closeAllChannels() {
	handles := s.listChannels()

	for _, handle := range handles {
		handle.cancel()
	}
	for _, handle := range handles {
		awaitDone(handle.done)
	}
}

func (s *ChannelService) readChannel(handle *channelHandle) {
	defer close(handle.done)
	defer s.removeChannel(handle.id)
	defer handle.cancel()
	defer handle.conn.CloseNow()

	reason, err := s.drainChannel(handle)

	switch {
	case handle.ctx.Err() != nil:
		s.emitter.Emit(EventChannelClose, ChannelCloseEvent{
			ChannelId: handle.id,
			Status:    StatusClosed,
			Reason:    reason,
		})
	case err == nil:
		s.emitter.Emit(EventChannelClose, ChannelCloseEvent{
			ChannelId: handle.id,
			Status:    StatusEof,
			Reason:    reason,
		})
	default:
		s.emitter.Emit(EventChannelError, ChannelErrorEvent{ChannelId: handle.id, Error: err.Error()})
		if reason == "" {
			reason = err.Error()
		}
		s.emitter.Emit(EventChannelClose, ChannelCloseEvent{
			ChannelId: handle.id,
			Status:    StatusError,
			Reason:    reason,
		})
	}
}

func (s *ChannelService) drainChannel(handle *channelHandle) (string, error) {
	reason := ""

	for {
		_, message, err := handle.conn.Read(handle.ctx)
		if err != nil {
			if isNormalClose(err) {
				return reason, nil
			}
			return reason, err
		}
		if len(message) == 0 {
			continue
		}

		payload := message[1:]

		switch message[0] {
		case channelStdout:
			s.emitData(handle.id, StreamStdout, payload)
		case channelStderr:
			s.emitData(handle.id, StreamStderr, payload)
		case channelStatus:
			// The server's own status document; it reaches the frontend unparsed.
			reason += string(payload)
		}
	}
}

func (s *ChannelService) emitData(channelId string, stream string, payload []byte) {
	if len(payload) == 0 {
		return
	}

	s.emitter.Emit(EventChannelData, ChannelDataEvent{
		ChannelId: channelId,
		Stream:    stream,
		Data:      base64.StdEncoding.EncodeToString(payload),
	})
}

func isTerminalSize(value int) bool {
	return value > 0 && value <= maxTerminalSize
}
