package kube

import (
	"crypto/tls"
	"crypto/x509"
	"net/http"
	"net/http/httptest"
	"testing"
)

func newMutualTlsServer(t *testing.T, authority testAuthority) *httptest.Server {
	t.Helper()

	serverPair := authority.issue(t, "kubernetes", []string{"127.0.0.1", "localhost"}, x509.ExtKeyUsageServerAuth)

	server := httptest.NewUnstartedServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		name := ""
		if len(request.TLS.PeerCertificates) > 0 {
			name = request.TLS.PeerCertificates[0].Subject.CommonName
		}
		_, _ = writer.Write([]byte(name))
	}))

	server.TLS = &tls.Config{
		MinVersion:   tls.VersionTLS12,
		Certificates: []tls.Certificate{serverPair.tlsCertificate(t)},
		ClientAuth:   tls.RequireAndVerifyClientCert,
		ClientCAs:    authority.pool(t),
	}

	server.StartTLS()
	t.Cleanup(server.Close)

	return server
}

func TestMutualTlsConnectionSucceeds(t *testing.T) {
	authority := newTestAuthority(t)
	server := newMutualTlsServer(t, authority)
	clientPair := authority.issue(t, "iappx-operator", nil, x509.ExtKeyUsageClientAuth)

	service, registry, _ := newTestService(t)
	sessionId := connect(t, registry, ConnectionSpec{
		Server:        server.URL,
		CaPem:         authority.pem,
		ClientCertPem: clientPair.certificatePem,
		ClientKeyPem:  clientPair.keyPem,
	})

	response := service.Send(Request{SessionId: sessionId, Path: "/api"})

	if !response.Success {
		t.Fatalf("mutual tls request failed: %+v", response)
	}
	if response.Body != "iappx-operator" {
		t.Fatalf("the client certificate did not reach the server: %q", response.Body)
	}
}

func TestConnectionWithoutAuthorityIsRejected(t *testing.T) {
	authority := newTestAuthority(t)
	server := newMutualTlsServer(t, authority)
	clientPair := authority.issue(t, "iappx-operator", nil, x509.ExtKeyUsageClientAuth)

	service, registry, _ := newTestService(t)
	sessionId := connect(t, registry, ConnectionSpec{
		Server:        server.URL,
		ClientCertPem: clientPair.certificatePem,
		ClientKeyPem:  clientPair.keyPem,
	})

	response := service.Send(Request{SessionId: sessionId, Path: "/api"})

	if response.Success {
		t.Fatal("an untrusted server certificate must not be accepted")
	}
	if response.Status != 0 || response.Error == "" {
		t.Fatalf("expected a tls failure, got %+v", response)
	}
}

func TestConnectionWithoutClientCertificateIsRejected(t *testing.T) {
	authority := newTestAuthority(t)
	server := newMutualTlsServer(t, authority)

	service, registry, _ := newTestService(t)
	sessionId := connect(t, registry, ConnectionSpec{Server: server.URL, CaPem: authority.pem})

	response := service.Send(Request{SessionId: sessionId, Path: "/api"})

	if response.Success {
		t.Fatalf("the server requires a client certificate, got %+v", response)
	}
}

func TestInsecureSkipTlsVerifyAcceptsUntrustedServer(t *testing.T) {
	authority := newTestAuthority(t)
	server := newMutualTlsServer(t, authority)
	clientPair := authority.issue(t, "iappx-operator", nil, x509.ExtKeyUsageClientAuth)

	service, registry, _ := newTestService(t)
	sessionId := connect(t, registry, ConnectionSpec{
		Server:                server.URL,
		ClientCertPem:         clientPair.certificatePem,
		ClientKeyPem:          clientPair.keyPem,
		InsecureSkipTlsVerify: true,
	})

	response := service.Send(Request{SessionId: sessionId, Path: "/api"})

	if !response.Success {
		t.Fatalf("expected the untrusted server to be accepted: %+v", response)
	}
}

func TestSessionKeepsAnUntouchedTlsConfigForDialers(t *testing.T) {
	authority := newTestAuthority(t)
	server := newMutualTlsServer(t, authority)
	clientPair := authority.issue(t, "iappx-operator", nil, x509.ExtKeyUsageClientAuth)

	service, registry, _ := newTestService(t)
	sessionId := connect(t, registry, ConnectionSpec{
		Server:        server.URL,
		CaPem:         authority.pem,
		ClientCertPem: clientPair.certificatePem,
		ClientKeyPem:  clientPair.keyPem,
		ServerName:    "127.0.0.1",
	})

	if response := service.Send(Request{SessionId: sessionId, Path: "/api"}); !response.Success {
		t.Fatalf("request failed: %+v", response)
	}

	session, found := registry.Get(sessionId)
	if !found {
		t.Fatal("session disappeared")
	}
	if session.TLSConfig == nil || len(session.TLSConfig.Certificates) != 1 {
		t.Fatalf("the session lost its client certificate: %+v", session.TLSConfig)
	}
	if session.TLSConfig.RootCAs == nil {
		t.Fatal("the session lost its authority pool")
	}
	if session.TLSConfig.ServerName != "127.0.0.1" {
		t.Fatalf("the sni override was not kept: %q", session.TLSConfig.ServerName)
	}
	if len(session.TLSConfig.NextProtos) != 0 {
		t.Fatalf("the transport mutated the shared config: %v", session.TLSConfig.NextProtos)
	}
}
