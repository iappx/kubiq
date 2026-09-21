package kube

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSendReturnsResponseBody(t *testing.T) {
	server := newTlsServer(t, func(writer http.ResponseWriter, request *http.Request) {
		body, _ := io.ReadAll(request.Body)
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte(request.Method + " " + request.URL.Path + " " + string(body)))
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	response := service.Send(Request{
		SessionId: sessionId,
		Method:    "POST",
		Path:      "/api/v1/namespaces/default/pods",
		Body:      `{"kind":"Pod"}`,
	})

	if !response.Success {
		t.Fatalf("expected success, got %+v", response)
	}
	if response.Status != http.StatusOK {
		t.Fatalf("expected 200, got %d", response.Status)
	}
	if response.Body != `POST /api/v1/namespaces/default/pods {"kind":"Pod"}` {
		t.Fatalf("unexpected body: %q", response.Body)
	}
	if response.Headers["Content-Type"] != "application/json" {
		t.Fatalf("unexpected headers: %+v", response.Headers)
	}
}

func TestSendDefaultsToGet(t *testing.T) {
	server := newTlsServer(t, func(writer http.ResponseWriter, request *http.Request) {
		_, _ = writer.Write([]byte(request.Method))
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	response := service.Send(Request{SessionId: sessionId, Path: "/version"})

	if !response.Success || response.Body != http.MethodGet {
		t.Fatalf("expected a GET, got %+v", response)
	}
}

func TestSendKeepsPathAndQueryIntact(t *testing.T) {
	server := newTlsServer(t, func(writer http.ResponseWriter, request *http.Request) {
		_, _ = writer.Write([]byte(request.URL.EscapedPath() + "|" + request.URL.RawQuery))
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	const path = "/api/v1/namespaces/kube-system/pods?labelSelector=app%3Dnginx&limit=5&watch=false"
	response := service.Send(Request{SessionId: sessionId, Path: path})

	expected := "/api/v1/namespaces/kube-system/pods|labelSelector=app%3Dnginx&limit=5&watch=false"
	if response.Body != expected {
		t.Fatalf("expected %q, got %q", expected, response.Body)
	}
}

func TestSendKeepsBasePathPrefix(t *testing.T) {
	server := newTlsServer(t, func(writer http.ResponseWriter, request *http.Request) {
		_, _ = writer.Write([]byte(request.URL.Path))
	})

	service, registry, _ := newTestService(t)
	sessionId := connect(t, registry, ConnectionSpec{
		Server: server.URL + "/k8s/clusters/c-m-abcdef/",
		CaPem:  encodePem("CERTIFICATE", server.Certificate().Raw),
	})

	response := service.Send(Request{SessionId: sessionId, Path: "/api/v1/nodes"})

	if response.Body != "/k8s/clusters/c-m-abcdef/api/v1/nodes" {
		t.Fatalf("unexpected path: %q", response.Body)
	}
}

func TestSendAppliesSessionAuthAndLetsRequestHeadersWin(t *testing.T) {
	server := newTlsServer(t, func(writer http.ResponseWriter, request *http.Request) {
		_, _ = writer.Write([]byte(request.Header.Get("Authorization") + "|" + request.Header.Get("Accept")))
	})

	service, registry, _ := newTestService(t)
	sessionId := connect(t, registry, ConnectionSpec{
		Server: server.URL,
		CaPem:  encodePem("CERTIFICATE", server.Certificate().Raw),
		Token:  "session-token",
	})

	withSessionAuth := service.Send(Request{
		SessionId: sessionId,
		Path:      "/api",
		Headers:   map[string]string{"Accept": "application/json"},
	})
	if withSessionAuth.Body != "Bearer session-token|application/json" {
		t.Fatalf("session auth was not applied: %q", withSessionAuth.Body)
	}

	withOverride := service.Send(Request{
		SessionId: sessionId,
		Path:      "/api",
		Headers:   map[string]string{"Authorization": "Bearer request-token"},
	})
	if !strings.HasPrefix(withOverride.Body, "Bearer request-token|") {
		t.Fatalf("request header did not win: %q", withOverride.Body)
	}
}

func TestSendUsesBasicAuthWithoutToken(t *testing.T) {
	server := newTlsServer(t, func(writer http.ResponseWriter, request *http.Request) {
		user, password, ok := request.BasicAuth()
		if !ok {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = writer.Write([]byte(user + ":" + password))
	})

	service, registry, _ := newTestService(t)
	sessionId := connect(t, registry, ConnectionSpec{
		Server:   server.URL,
		CaPem:    encodePem("CERTIFICATE", server.Certificate().Raw),
		Username: "operator",
		Password: "hunter2",
	})

	response := service.Send(Request{SessionId: sessionId, Path: "/api"})

	if response.Body != "operator:hunter2" {
		t.Fatalf("basic auth was not applied: %q", response.Body)
	}
}

func TestSendReportsNotFoundAsData(t *testing.T) {
	const status = `{"kind":"Status","code":404,"reason":"NotFound"}`

	server := newTlsServer(t, func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusNotFound)
		_, _ = writer.Write([]byte(status))
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	response := service.Send(Request{SessionId: sessionId, Path: "/api/v1/namespaces/default/pods/missing"})

	if response.Success {
		t.Fatal("a 404 must not be reported as success")
	}
	if response.Status != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", response.Status)
	}
	if response.Body != status {
		t.Fatalf("status body was lost: %q", response.Body)
	}
	if response.Error != "" {
		t.Fatalf("an http status is not a transport error: %q", response.Error)
	}
}

func TestSendReportsServerErrorAsData(t *testing.T) {
	server := newTlsServer(t, func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusInternalServerError)
		_, _ = writer.Write([]byte("boom"))
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	response := service.Send(Request{SessionId: sessionId, Path: "/api"})

	if response.Success || response.Status != http.StatusInternalServerError || response.Body != "boom" {
		t.Fatalf("unexpected response: %+v", response)
	}
}

func TestSendReportsUnreachableServer(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	certificate := encodePem("CERTIFICATE", server.Certificate().Raw)
	address := server.URL
	server.Close()

	service, registry, _ := newTestService(t)
	sessionId := connect(t, registry, ConnectionSpec{Server: address, CaPem: certificate})

	response := service.Send(Request{SessionId: sessionId, Path: "/api"})

	if response.Success {
		t.Fatal("a closed server must not be reported as success")
	}
	if response.Status != 0 {
		t.Fatalf("a transport failure has no http status, got %d", response.Status)
	}
	if response.Error == "" {
		t.Fatal("expected a transport error message")
	}
}

func TestSendHonoursRequestTimeout(t *testing.T) {
	server := newTlsServer(t, func(_ http.ResponseWriter, request *http.Request) {
		<-request.Context().Done()
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	response := service.Send(Request{SessionId: sessionId, Path: "/api", TimeoutSeconds: 1})

	if response.Success || response.Status != 0 || response.Error == "" {
		t.Fatalf("expected a timeout failure, got %+v", response)
	}
}

func TestSendRejectsUnknownSession(t *testing.T) {
	service, _, _ := newTestService(t)

	response := service.Send(Request{SessionId: "nope", Path: "/api"})

	if response.Success || !strings.Contains(response.Error, "unknown session") {
		t.Fatalf("unexpected response: %+v", response)
	}
}

func TestConnectRejectsInvalidSpecs(t *testing.T) {
	service := NewConnectionService(NewSessionRegistry())

	cases := map[string]ConnectionSpec{
		"empty server":       {},
		"unsupported scheme": {Server: "ftp://127.0.0.1"},
		"broken ca":          {Server: "https://127.0.0.1:6443", CaPem: "not a certificate"},
		"half a key pair":    {Server: "https://127.0.0.1:6443", ClientCertPem: "cert only"},
	}

	for name, spec := range cases {
		t.Run(name, func(t *testing.T) {
			result := service.Connect(spec)
			if result.Success || result.Error == "" {
				t.Fatalf("expected a rejection, got %+v", result)
			}
		})
	}
}

func TestSessionsAndDisconnect(t *testing.T) {
	registry := NewSessionRegistry()
	t.Cleanup(registry.Close)
	service := NewConnectionService(registry)

	first := service.Connect(ConnectionSpec{Server: "https://one.example:6443"})
	second := service.Connect(ConnectionSpec{Server: "https://two.example:6443"})
	if !first.Success || !second.Success {
		t.Fatal("expected both connections to be accepted")
	}

	sessions := service.Sessions()
	if !sessions.Success || len(sessions.Sessions) != 2 {
		t.Fatalf("expected two sessions, got %+v", sessions)
	}
	for _, info := range sessions.Sessions {
		if info.Id == "" || info.Server == "" || info.CreatedAt == "" {
			t.Fatalf("incomplete session info: %+v", info)
		}
	}

	if result := service.Disconnect(first.SessionId); !result.Success {
		t.Fatalf("disconnect failed: %s", result.Error)
	}
	if result := service.Disconnect(first.SessionId); result.Success {
		t.Fatal("disconnecting twice must fail")
	}

	remaining := service.Sessions()
	if len(remaining.Sessions) != 1 || remaining.Sessions[0].Id != second.SessionId {
		t.Fatalf("unexpected sessions after disconnect: %+v", remaining)
	}
}

func TestDisconnectCancelsInFlightRequests(t *testing.T) {
	released := make(chan struct{})
	server := newTlsServer(t, func(_ http.ResponseWriter, request *http.Request) {
		close(released)
		<-request.Context().Done()
	})

	service, registry, _ := newTestService(t)
	sessionId := connectToServer(t, registry, server)

	failure := make(chan Response, 1)
	go func() {
		failure <- service.Send(Request{SessionId: sessionId, Path: "/api"})
	}()

	<-released
	NewConnectionService(registry).Disconnect(sessionId)

	response := <-failure
	if response.Success || response.Error == "" {
		t.Fatalf("expected the request to be cancelled, got %+v", response)
	}
}
