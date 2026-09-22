package kube

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	defaultRequestTimeout = 30 * time.Second
	dialTimeout           = 30 * time.Second
	keepAlivePeriod       = 30 * time.Second
	handshakeTimeout      = 15 * time.Second
	idleConnTimeout       = 90 * time.Second
	maxIdleConns          = 64
	maxIdleConnsPerHost   = 16
)

type Session struct {
	ID         string
	Label      string
	BaseURL    *url.URL
	Client     *http.Client
	TLSConfig  *tls.Config
	AuthHeader http.Header
	ProxyURL   *url.URL
	CreatedAt  time.Time

	ctx     context.Context
	cancel  context.CancelFunc
	timeout time.Duration
}

func (s *Session) Context() context.Context {
	return s.ctx
}

func (s *Session) Timeout() time.Duration {
	return s.timeout
}

func (s *Session) resolve(path string) string {
	base := strings.TrimSuffix(s.BaseURL.String(), "/")
	if path == "" {
		return base
	}
	if !strings.HasPrefix(path, "/") && !strings.HasPrefix(path, "?") {
		path = "/" + path
	}
	return base + path
}

func (s *Session) close() {
	s.cancel()
	s.Client.CloseIdleConnections()
}

func newSession(spec ConnectionSpec) (*Session, error) {
	baseURL, err := parseServer(spec.Server)
	if err != nil {
		return nil, err
	}

	tlsConfig, err := buildTLSConfig(spec)
	if err != nil {
		return nil, err
	}

	var proxyURL *url.URL
	if proxy := strings.TrimSpace(spec.ProxyUrl); proxy != "" {
		proxyURL, err = url.Parse(proxy)
		if err != nil {
			return nil, errors.New("proxy address is not a valid url: " + proxy)
		}
	}

	timeout := defaultRequestTimeout
	if spec.TimeoutSeconds > 0 {
		timeout = time.Duration(spec.TimeoutSeconds) * time.Second
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &Session{
		ID:         newID(),
		Label:      spec.Label,
		BaseURL:    baseURL,
		Client:     &http.Client{Transport: newTransport(tlsConfig, proxyURL)},
		TLSConfig:  tlsConfig,
		AuthHeader: buildAuthHeader(spec),
		ProxyURL:   proxyURL,
		CreatedAt:  time.Now(),
		ctx:        ctx,
		cancel:     cancel,
		timeout:    timeout,
	}, nil
}

func parseServer(server string) (*url.URL, error) {
	address := strings.TrimSpace(server)
	if address == "" {
		return nil, errors.New("server address is required")
	}

	parsed, err := url.Parse(address)
	if err != nil {
		return nil, errors.New("server address is not a valid url")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, errors.New("server address must use http or https")
	}
	if parsed.Host == "" {
		return nil, errors.New("server address has no host")
	}

	return parsed, nil
}

func newTransport(tlsConfig *tls.Config, proxyURL *url.URL) *http.Transport {
	transport := &http.Transport{
		DialContext: (&net.Dialer{
			Timeout:   dialTimeout,
			KeepAlive: keepAlivePeriod,
		}).DialContext,
		// The session keeps its own copy so a websocket dialer can reuse the
		// unmodified one: http.Transport rewrites NextProtos when it enables h2.
		TLSClientConfig:       tlsConfig.Clone(),
		TLSHandshakeTimeout:   handshakeTimeout,
		IdleConnTimeout:       idleConnTimeout,
		MaxIdleConns:          maxIdleConns,
		MaxIdleConnsPerHost:   maxIdleConnsPerHost,
		ExpectContinueTimeout: time.Second,
		ForceAttemptHTTP2:     true,
	}

	if proxyURL != nil {
		transport.Proxy = http.ProxyURL(proxyURL)
	}

	return transport
}

func buildTLSConfig(spec ConnectionSpec) (*tls.Config, error) {
	config := &tls.Config{
		MinVersion:         tls.VersionTLS12,
		InsecureSkipVerify: spec.InsecureSkipTlsVerify,
	}

	if name := strings.TrimSpace(spec.ServerName); name != "" {
		config.ServerName = name
	}

	if ca := strings.TrimSpace(spec.CaPem); ca != "" {
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM([]byte(ca)) {
			return nil, errors.New("certificate authority bundle holds no usable certificate")
		}
		config.RootCAs = pool
	}

	certificate := strings.TrimSpace(spec.ClientCertPem)
	key := strings.TrimSpace(spec.ClientKeyPem)

	switch {
	case certificate != "" && key != "":
		// The underlying error is dropped rather than wrapped: nothing derived
		// from key material may travel back to the frontend.
		pair, err := tls.X509KeyPair([]byte(certificate), []byte(key))
		if err != nil {
			return nil, errors.New("client certificate and key are not a valid pair")
		}
		config.Certificates = []tls.Certificate{pair}
	case certificate != "" || key != "":
		return nil, errors.New("client certificate and key must be supplied together")
	}

	return config, nil
}

func buildAuthHeader(spec ConnectionSpec) http.Header {
	header := http.Header{}

	if token := strings.TrimSpace(spec.Token); token != "" {
		header.Set("Authorization", "Bearer "+token)
		return header
	}

	if spec.Username != "" {
		credentials := spec.Username + ":" + spec.Password
		header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(credentials)))
	}

	return header
}

func newID() string {
	buffer := make([]byte, 16)
	_, _ = rand.Read(buffer)
	return hex.EncodeToString(buffer)
}
