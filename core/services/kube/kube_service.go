package kube

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

type KubeService struct {
	registry *SessionRegistry
	emitter  eventEmitter

	mutex   sync.Mutex
	streams map[string]*streamHandle
}

func NewKubeService(registry *SessionRegistry) *KubeService {
	if registry == nil {
		registry = NewSessionRegistry()
	}
	return &KubeService{
		registry: registry,
		emitter:  wailsEmitter{},
		streams:  make(map[string]*streamHandle),
	}
}

func (s *KubeService) Send(request Request) (response Response) {
	// A panic inside a bound method takes the whole application down, so the
	// entry point turns one into an ordinary failed result.
	defer func() {
		if recovered := recover(); recovered != nil {
			response = Response{Error: fmt.Sprintf("request failed: %v", recovered)}
		}
	}()

	session, found := s.registry.Get(request.SessionId)
	if !found {
		return Response{Error: "unknown session: " + request.SessionId}
	}

	timeout := session.Timeout()
	if request.TimeoutSeconds > 0 {
		timeout = time.Duration(request.TimeoutSeconds) * time.Second
	}

	ctx, cancel := context.WithTimeout(session.Context(), timeout)
	defer cancel()

	outgoing, err := buildRequest(ctx, session, request.Method, request.Path, request.Headers, request.Body)
	if err != nil {
		return Response{Error: err.Error()}
	}

	incoming, err := session.Client.Do(outgoing)
	if err != nil {
		return Response{Error: err.Error()}
	}
	defer incoming.Body.Close()

	body, err := io.ReadAll(incoming.Body)
	if err != nil {
		return Response{
			Status:  incoming.StatusCode,
			Headers: flattenHeader(incoming.Header),
			Error:   err.Error(),
		}
	}

	return Response{
		Success: incoming.StatusCode >= 200 && incoming.StatusCode < 300,
		Status:  incoming.StatusCode,
		Headers: flattenHeader(incoming.Header),
		Body:    string(body),
	}
}

func buildRequest(
	ctx context.Context,
	session *Session,
	method string,
	path string,
	headers map[string]string,
	body string,
) (*http.Request, error) {
	var payload io.Reader
	if body != "" {
		payload = strings.NewReader(body)
	}

	request, err := http.NewRequestWithContext(
		ctx,
		strings.ToUpper(strings.TrimSpace(method)),
		session.resolve(path),
		payload,
	)
	if err != nil {
		return nil, err
	}

	for name, values := range session.AuthHeader {
		for _, value := range values {
			request.Header.Add(name, value)
		}
	}

	for name, value := range headers {
		if strings.TrimSpace(name) == "" {
			continue
		}
		// net/http ignores a Host entry in the header map; the override only
		// takes effect through the request field.
		if strings.EqualFold(name, "Host") {
			request.Host = value
			continue
		}
		request.Header.Set(name, value)
	}

	return request, nil
}

func flattenHeader(header http.Header) map[string]string {
	flattened := make(map[string]string, len(header))
	for name, values := range header {
		flattened[name] = strings.Join(values, ", ")
	}
	return flattened
}
