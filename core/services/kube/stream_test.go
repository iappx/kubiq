package kube

import (
	"fmt"
	"net/http"
	"runtime"
	"strings"
	"testing"
)

func TestStreamDeliversLinesSeparately(t *testing.T) {
	lines := []string{
		`{"type":"ADDED","object":{"metadata":{"name":"pod-a"}}}`,
		`{"type":"MODIFIED","object":{"metadata":{"name":"pod-b"}}}`,
		`{"type":"DELETED","object":{"metadata":{"name":"pod-c"}}}`,
	}

	server := newTlsServer(t, func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusOK)
		writer.(http.Flusher).Flush()

		for _, line := range lines {
			_, _ = writer.Write([]byte(line + "\n"))
			writer.(http.Flusher).Flush()
		}

		<-request.Context().Done()
	})

	service, registry, emitter := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	result := service.StartStream(StreamRequest{
		SessionId: sessionId,
		Path:      "/api/v1/namespaces/default/pods?watch=true",
		Mode:      StreamModeLines,
	})
	if !result.Success {
		t.Fatalf("stream did not start: %s", result.Error)
	}

	emitter.await(t, "three watch events", func() bool {
		return len(emitter.chunks(result.StreamId)) >= len(lines)
	})

	received := emitter.chunks(result.StreamId)
	for index, line := range lines {
		if received[index] != line {
			t.Fatalf("chunk %d: expected %q, got %q", index, line, received[index])
		}
	}

	if stopped := service.StopStream(result.StreamId); !stopped.Success {
		t.Fatalf("stop failed: %s", stopped.Error)
	}
}

func TestStreamCarriesLinesLargerThanTheScannerDefault(t *testing.T) {
	payload := `{"type":"ADDED","object":"` + strings.Repeat("k", 1_500_000) + `"}`

	server := newTlsServer(t, func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte(payload + "\n"))
		writer.(http.Flusher).Flush()
		<-request.Context().Done()
	})

	service, registry, emitter := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	result := service.StartStream(StreamRequest{SessionId: sessionId, Path: "/api/v1/pods?watch=true"})
	if !result.Success {
		t.Fatalf("stream did not start: %s", result.Error)
	}

	emitter.await(t, "the oversized line", func() bool {
		return len(emitter.chunks(result.StreamId)) >= 1
	})

	received := emitter.chunks(result.StreamId)[0]
	if received != payload {
		t.Fatalf("expected %d bytes intact, got %d", len(payload), len(received))
	}
	if messages := emitter.errors(result.StreamId); len(messages) != 0 {
		t.Fatalf("a long line must not fail the stream: %v", messages)
	}

	service.StopStream(result.StreamId)
}

func TestStreamRawModeDeliversChunksUnsplit(t *testing.T) {
	server := newTlsServer(t, func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("first\nsecond\n"))
		writer.(http.Flusher).Flush()
		<-request.Context().Done()
	})

	service, registry, emitter := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	result := service.StartStream(StreamRequest{
		SessionId: sessionId,
		Path:      "/api/v1/namespaces/default/pods/x/log?follow=true",
		Mode:      StreamModeRaw,
	})
	if !result.Success {
		t.Fatalf("stream did not start: %s", result.Error)
	}

	emitter.await(t, "the raw chunk", func() bool {
		return strings.Contains(strings.Join(emitter.chunks(result.StreamId), ""), "second\n")
	})

	if joined := strings.Join(emitter.chunks(result.StreamId), ""); joined != "first\nsecond\n" {
		t.Fatalf("raw mode altered the payload: %q", joined)
	}

	service.StopStream(result.StreamId)
}

func TestStopStreamEndsTheStream(t *testing.T) {
	server := newIdleStreamServer(t)

	service, registry, emitter := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	result := service.StartStream(StreamRequest{SessionId: sessionId, Path: "/api/v1/pods?watch=true"})
	if !result.Success {
		t.Fatalf("stream did not start: %s", result.Error)
	}

	if listed := service.Streams(); len(listed.Streams) != 1 || listed.Streams[0].Id != result.StreamId {
		t.Fatalf("expected the stream to be listed, got %+v", listed)
	}

	if stopped := service.StopStream(result.StreamId); !stopped.Success {
		t.Fatalf("stop failed: %s", stopped.Error)
	}

	status, found := emitter.closeStatus(result.StreamId)
	if !found || status != StreamStatusStopped {
		t.Fatalf("expected a %q close event, got %q (found=%v)", StreamStatusStopped, status, found)
	}
	if listed := service.Streams(); len(listed.Streams) != 0 {
		t.Fatalf("a stopped stream must be forgotten, got %+v", listed)
	}
	if again := service.StopStream(result.StreamId); again.Success {
		t.Fatal("stopping an unknown stream must fail")
	}
}

func TestStreamReportsBrokenConnection(t *testing.T) {
	payload := `{"type":"ADDED","object":{"metadata":{"name":"pod-a"}}}` + "\n"

	server := newTlsServer(t, func(writer http.ResponseWriter, _ *http.Request) {
		hijacker, ok := writer.(http.Hijacker)
		if !ok {
			writer.WriteHeader(http.StatusInternalServerError)
			return
		}

		connection, buffered, err := hijacker.Hijack()
		if err != nil {
			return
		}

		// The chunked body is cut off mid-stream: the terminating zero chunk is
		// never written, so the client sees a broken connection rather than eof.
		_, _ = buffered.WriteString("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n")
		_, _ = buffered.WriteString(fmt.Sprintf("%x\r\n%s\r\n", len(payload), payload))
		_ = buffered.Flush()
		_ = connection.Close()
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

	if messages := emitter.errors(result.StreamId); len(messages) == 0 {
		t.Fatal("a broken connection must raise an error event")
	}
	if status, _ := emitter.closeStatus(result.StreamId); status != StreamStatusError {
		t.Fatalf("expected a %q close event, got %q", StreamStatusError, status)
	}
	if received := emitter.chunks(result.StreamId); len(received) != 1 || received[0] != strings.TrimSuffix(payload, "\n") {
		t.Fatalf("the line sent before the break was lost: %+v", received)
	}
}

func TestStreamReportsEndOfStream(t *testing.T) {
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

	if status, _ := emitter.closeStatus(result.StreamId); status != StreamStatusEof {
		t.Fatalf("expected a %q close event, got %q", StreamStatusEof, status)
	}
	if messages := emitter.errors(result.StreamId); len(messages) != 0 {
		t.Fatalf("a clean end of stream is not an error: %v", messages)
	}
}

func TestStartStreamReportsHttpFailureAsData(t *testing.T) {
	const status = `{"kind":"Status","code":403,"reason":"Forbidden"}`

	server := newTlsServer(t, func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusForbidden)
		_, _ = writer.Write([]byte(status))
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	result := service.StartStream(StreamRequest{SessionId: sessionId, Path: "/api/v1/pods?watch=true"})

	if result.Success {
		t.Fatal("a rejected stream must not report success")
	}
	if result.Error != status {
		t.Fatalf("the status body was lost: %q", result.Error)
	}
	if listed := service.Streams(); len(listed.Streams) != 0 {
		t.Fatalf("a stream that never started must not be listed: %+v", listed)
	}
}

func TestStartStreamRejectsUnknownSessionAndMode(t *testing.T) {
	service, registry, _ := newTestService(t)
	sessionId := connect(t, registry, ConnectionSpec{Server: "https://127.0.0.1:6443"})

	unknown := service.StartStream(StreamRequest{SessionId: "nope", Path: "/api"})
	if unknown.Success || !strings.Contains(unknown.Error, "unknown session") {
		t.Fatalf("unexpected result: %+v", unknown)
	}

	badMode := service.StartStream(StreamRequest{SessionId: sessionId, Path: "/api", Mode: "sideways"})
	if badMode.Success || !strings.Contains(badMode.Error, "unsupported stream mode") {
		t.Fatalf("unexpected result: %+v", badMode)
	}
}

func TestStreamLimitIsEnforced(t *testing.T) {
	server := newIdleStreamServer(t)

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	for index := 0; index < maxConcurrentStreams; index++ {
		result := service.StartStream(StreamRequest{SessionId: sessionId, Path: "/api/v1/pods?watch=true"})
		if !result.Success {
			t.Fatalf("stream %d did not start: %s", index, result.Error)
		}
	}

	refused := service.StartStream(StreamRequest{SessionId: sessionId, Path: "/api/v1/pods?watch=true"})
	if refused.Success || !strings.Contains(refused.Error, "stream limit reached") {
		t.Fatalf("expected the limit to be refused, got %+v", refused)
	}

	service.stopAll()

	if listed := service.Streams(); len(listed.Streams) != 0 {
		t.Fatalf("expected every stream to be gone, got %d", len(listed.Streams))
	}
}

func TestStreamsReleaseGoroutines(t *testing.T) {
	baseline := runtime.NumGoroutine()

	server := newIdleStreamServer(t)
	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	var started []string
	for index := 0; index < 4; index++ {
		result := service.StartStream(StreamRequest{SessionId: sessionId, Path: "/api/v1/pods?watch=true"})
		if !result.Success {
			t.Fatalf("stream %d did not start: %s", index, result.Error)
		}
		started = append(started, result.StreamId)
	}

	for _, streamId := range started {
		if stopped := service.StopStream(streamId); !stopped.Success {
			t.Fatalf("stop failed: %s", stopped.Error)
		}
	}

	registry.Close()
	server.Close()

	waitForGoroutines(t, baseline)
}

func TestRegistryCloseStopsStreams(t *testing.T) {
	server := newIdleStreamServer(t)

	service, registry, emitter := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	result := service.StartStream(StreamRequest{SessionId: sessionId, Path: "/api/v1/pods?watch=true"})
	if !result.Success {
		t.Fatalf("stream did not start: %s", result.Error)
	}

	registry.Close()

	emitter.await(t, "the close event", func() bool {
		_, found := emitter.closeStatus(result.StreamId)
		return found
	})

	if status, _ := emitter.closeStatus(result.StreamId); status != StreamStatusStopped {
		t.Fatalf("expected a %q close event, got %q", StreamStatusStopped, status)
	}
}
