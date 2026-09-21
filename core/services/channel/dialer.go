package channel

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/coder/websocket"

	"iappx_k8s_admin/core/services/kube"
)

const (
	dialTimeout      = 30 * time.Second
	keepAlivePeriod  = 30 * time.Second
	handshakeTimeout = 15 * time.Second
	readLimitBytes   = 16 * 1024 * 1024
)

func dial(
	ctx context.Context,
	session *kube.Session,
	path string,
	subprotocols []string,
	headers map[string]string,
) (*websocket.Conn, error) {
	requested := cleanSubprotocols(subprotocols)

	client := &http.Client{Transport: newDialTransport(session)}
	defer client.CloseIdleConnections()

	conn, _, err := websocket.Dial(ctx, resolve(session, path), &websocket.DialOptions{
		HTTPClient:   client,
		HTTPHeader:   dialHeader(session, headers),
		Host:         hostOverride(headers),
		Subprotocols: requested,
	})
	if err != nil {
		return nil, err
	}

	if len(requested) > 0 && !slices.Contains(requested, conn.Subprotocol()) {
		conn.CloseNow()
		return nil, errors.New(
			"server did not negotiate the requested subprotocol (" +
				strings.Join(requested, ", ") + "); Kubernetes 1.30+ is required",
		)
	}

	conn.SetReadLimit(readLimitBytes)

	return conn, nil
}

func newDialTransport(session *kube.Session) *http.Transport {
	transport := &http.Transport{
		DialContext: (&net.Dialer{
			Timeout:   dialTimeout,
			KeepAlive: keepAlivePeriod,
		}).DialContext,
		TLSHandshakeTimeout: handshakeTimeout,
		// The handshake is bounded here rather than by a context deadline: the
		// same context stays with the connection for its whole life.
		ResponseHeaderTimeout: session.Timeout(),
		ExpectContinueTimeout: time.Second,
	}

	if session.TLSConfig != nil {
		config := session.TLSConfig.Clone()
		// HTTP/2 carries no upgrade handshake, so ALPN is pinned: against an
		// h2-capable api server the websocket dial would never switch protocols.
		config.NextProtos = []string{"http/1.1"}
		transport.TLSClientConfig = config
	}

	if session.ProxyURL != nil {
		transport.Proxy = http.ProxyURL(session.ProxyURL)
	}

	return transport
}

func dialHeader(session *kube.Session, headers map[string]string) http.Header {
	header := http.Header{}

	for name, values := range session.AuthHeader {
		for _, value := range values {
			header.Add(name, value)
		}
	}

	for name, value := range headers {
		if strings.TrimSpace(name) == "" || strings.EqualFold(name, "Host") {
			continue
		}
		header.Set(name, value)
	}

	return header
}

func hostOverride(headers map[string]string) string {
	for name, value := range headers {
		if strings.EqualFold(name, "Host") {
			return value
		}
	}

	return ""
}

func cleanSubprotocols(subprotocols []string) []string {
	cleaned := make([]string, 0, len(subprotocols))
	for _, subprotocol := range subprotocols {
		if trimmed := strings.TrimSpace(subprotocol); trimmed != "" {
			cleaned = append(cleaned, trimmed)
		}
	}

	return cleaned
}

func resolve(session *kube.Session, path string) string {
	base := strings.TrimSuffix(session.BaseURL.String(), "/")
	if path == "" {
		return base
	}
	if !strings.HasPrefix(path, "/") && !strings.HasPrefix(path, "?") {
		path = "/" + path
	}

	return base + path
}

func writeFrame(ctx context.Context, conn *websocket.Conn, frame byte, payload []byte) error {
	message := make([]byte, 0, len(payload)+1)
	message = append(message, frame)
	message = append(message, payload...)

	return conn.Write(ctx, websocket.MessageBinary, message)
}

func isNormalClose(err error) bool {
	switch websocket.CloseStatus(err) {
	case websocket.StatusNormalClosure, websocket.StatusGoingAway:
		return true
	}

	return errors.Is(err, io.EOF) || errors.Is(err, net.ErrClosed)
}
