package kube

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"time"
)

const (
	maxConcurrentStreams = 32
	initialLineBytes     = 64 * 1024
	maxLineBytes         = 16 * 1024 * 1024
	rawChunkBytes        = 32 * 1024
	maxStartErrorBytes   = 64 * 1024
	stopWaitTimeout      = 5 * time.Second
)

type streamHandle struct {
	id        string
	sessionId string
	path      string
	mode      string
	startedAt time.Time
	ctx       context.Context
	cancel    context.CancelFunc
	done      chan struct{}
}

func (s *KubeService) StartStream(request StreamRequest) (result StreamResult) {
	defer func() {
		if recovered := recover(); recovered != nil {
			result = StreamResult{Error: fmt.Sprintf("stream failed: %v", recovered)}
		}
	}()

	session, found := s.registry.Get(request.SessionId)
	if !found {
		return StreamResult{Error: "unknown session: " + request.SessionId}
	}

	mode := strings.ToLower(strings.TrimSpace(request.Mode))
	if mode == "" {
		mode = StreamModeLines
	}
	if mode != StreamModeLines && mode != StreamModeRaw {
		return StreamResult{Error: "unsupported stream mode: " + request.Mode}
	}

	ctx, cancel := context.WithCancel(session.Context())
	handle := &streamHandle{
		id:        newID(),
		sessionId: session.ID,
		path:      request.Path,
		mode:      mode,
		startedAt: time.Now(),
		ctx:       ctx,
		cancel:    cancel,
		done:      make(chan struct{}),
	}

	// The handle is registered before the request is made so the limit counts
	// streams that are still opening, not only those already reading.
	if err := s.register(handle); err != nil {
		cancel()
		return StreamResult{Error: err.Error()}
	}

	outgoing, err := buildRequest(ctx, session, request.Method, request.Path, request.Headers, request.Body)
	if err != nil {
		s.release(handle)
		return StreamResult{Error: err.Error()}
	}

	incoming, err := session.Client.Do(outgoing)
	if err != nil {
		s.release(handle)
		return StreamResult{Error: err.Error()}
	}

	if incoming.StatusCode < 200 || incoming.StatusCode >= 300 {
		message := readStartError(incoming)
		incoming.Body.Close()
		s.release(handle)
		return StreamResult{Error: message}
	}

	go s.pump(handle, incoming)

	return StreamResult{Success: true, StreamId: handle.id}
}

func (s *KubeService) StopStream(streamId string) KubeResult {
	s.mutex.Lock()
	handle, found := s.streams[streamId]
	s.mutex.Unlock()

	if !found {
		return KubeResult{Error: "unknown stream: " + streamId}
	}

	s.stop(handle)

	return KubeResult{Success: true}
}

func (s *KubeService) Streams() StreamsResult {
	s.mutex.Lock()
	handles := make([]*streamHandle, 0, len(s.streams))
	for _, handle := range s.streams {
		handles = append(handles, handle)
	}
	s.mutex.Unlock()

	slices.SortFunc(handles, func(left *streamHandle, right *streamHandle) int {
		if left.startedAt.Equal(right.startedAt) {
			return strings.Compare(left.id, right.id)
		}
		return left.startedAt.Compare(right.startedAt)
	})

	infos := make([]StreamInfo, 0, len(handles))
	for _, handle := range handles {
		infos = append(infos, StreamInfo{
			Id:        handle.id,
			SessionId: handle.sessionId,
			Path:      handle.path,
			Mode:      handle.mode,
			StartedAt: handle.startedAt.UTC().Format(time.RFC3339),
		})
	}

	return StreamsResult{Success: true, Streams: infos}
}

func (s *KubeService) ServiceShutdown() error {
	s.stopAll()
	return nil
}

func (s *KubeService) stopAll() {
	s.mutex.Lock()
	handles := make([]*streamHandle, 0, len(s.streams))
	for _, handle := range s.streams {
		handles = append(handles, handle)
	}
	s.mutex.Unlock()

	for _, handle := range handles {
		handle.cancel()
	}
	for _, handle := range handles {
		s.stop(handle)
	}
}

func (s *KubeService) stop(handle *streamHandle) {
	handle.cancel()

	// Cancelling closes the body and unblocks the reader, but a bound method
	// must return even if some transport fails to honour that.
	timer := time.NewTimer(stopWaitTimeout)
	defer timer.Stop()

	select {
	case <-handle.done:
	case <-timer.C:
	}
}

func (s *KubeService) register(handle *streamHandle) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if len(s.streams) >= maxConcurrentStreams {
		return fmt.Errorf("stream limit reached: %d streams are already running", maxConcurrentStreams)
	}

	s.streams[handle.id] = handle
	return nil
}

func (s *KubeService) remove(id string) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	delete(s.streams, id)
}

func (s *KubeService) release(handle *streamHandle) {
	s.remove(handle.id)
	handle.cancel()
	close(handle.done)
}

func (s *KubeService) pump(handle *streamHandle, response *http.Response) {
	defer close(handle.done)
	defer s.remove(handle.id)
	defer handle.cancel()
	defer response.Body.Close()

	err := s.drain(handle, response.Body)

	switch {
	case handle.ctx.Err() != nil:
		s.emitter.Emit(EventStreamClose, StreamCloseEvent{StreamId: handle.id, Status: StreamStatusStopped})
	case err == nil:
		s.emitter.Emit(EventStreamClose, StreamCloseEvent{StreamId: handle.id, Status: StreamStatusEof})
	default:
		s.emitter.Emit(EventStreamError, StreamErrorEvent{StreamId: handle.id, Error: err.Error()})
		s.emitter.Emit(EventStreamClose, StreamCloseEvent{StreamId: handle.id, Status: StreamStatusError})
	}
}

func (s *KubeService) drain(handle *streamHandle, body io.Reader) error {
	if handle.mode == StreamModeRaw {
		return s.drainRaw(handle, body)
	}
	return s.drainLines(handle, body)
}

func (s *KubeService) drainLines(handle *streamHandle, body io.Reader) error {
	scanner := bufio.NewScanner(body)
	// A single line can run to hundreds of kilobytes; on the 64 KiB default the
	// scanner stops with ErrTooLong instead of reading on.
	scanner.Buffer(make([]byte, 0, initialLineBytes), maxLineBytes)

	for scanner.Scan() {
		s.emitter.Emit(EventStreamChunk, StreamChunkEvent{StreamId: handle.id, Data: scanner.Text()})
	}

	return scanner.Err()
}

func (s *KubeService) drainRaw(handle *streamHandle, body io.Reader) error {
	buffer := make([]byte, rawChunkBytes)

	for {
		read, err := body.Read(buffer)
		if read > 0 {
			s.emitter.Emit(EventStreamChunk, StreamChunkEvent{StreamId: handle.id, Data: string(buffer[:read])})
		}
		if err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}
			return err
		}
	}
}

func readStartError(response *http.Response) string {
	// The body is the server's own error document and the frontend parses it,
	// so it travels back unchanged rather than wrapped in a message.
	body, _ := io.ReadAll(io.LimitReader(response.Body, maxStartErrorBytes))
	if len(body) > 0 {
		return string(body)
	}
	return response.Status
}
