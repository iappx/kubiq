package kube

import (
	"crypto/x509"
	"encoding/json"
	"strings"
	"testing"
)

func TestConnectionResultsCarryNoCredentials(t *testing.T) {
	const bearerToken = "SECRET-BEARER-TOKEN-8f21c0"
	const password = "SECRET-PASSWORD-3ad91b"
	const urlPassword = "SECRET-URL-PASSWORD-77c1e4"

	authority := newTestAuthority(t)
	clientPair := authority.issue(t, "iappx-operator", nil, x509.ExtKeyUsageClientAuth)

	registry := NewSessionRegistry()
	t.Cleanup(registry.Close)
	service := NewConnectionService(registry)

	connected := service.Connect(ConnectionSpec{
		Server:        "https://operator:" + urlPassword + "@127.0.0.1:6443",
		CaPem:         authority.pem,
		ClientCertPem: clientPair.certificatePem,
		ClientKeyPem:  clientPair.keyPem,
		Token:         bearerToken,
		Username:      "operator",
		Password:      password,
	})
	if !connected.Success {
		t.Fatalf("connect failed: %s", connected.Error)
	}

	secrets := map[string]string{
		"bearer token":     bearerToken,
		"password":         password,
		"url password":     urlPassword,
		"client key pem":   clientPair.keyPem,
		"client key body":  longestLine(clientPair.keyPem),
		"client cert pem":  clientPair.certificatePem,
		"client cert body": longestLine(clientPair.certificatePem),
		"authority pem":    authority.pem,
	}

	payloads := map[string]any{
		"ConnectResult":  connected,
		"SessionsResult": service.Sessions(),
	}

	for name, payload := range payloads {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("serialise %s: %v", name, err)
		}

		for label, secret := range secrets {
			if secret == "" {
				t.Fatalf("test fixture %q is empty", label)
			}
			if strings.Contains(string(encoded), secret) {
				t.Fatalf("%s leaks the %s to the frontend", name, label)
			}
		}
	}
}

func TestSessionsReportOnlyIdServerAndCreationTime(t *testing.T) {
	registry := NewSessionRegistry()
	t.Cleanup(registry.Close)
	service := NewConnectionService(registry)

	connected := service.Connect(ConnectionSpec{
		Server: "https://operator:SECRET-URL-PASSWORD@127.0.0.1:6443/base",
		Token:  "SECRET-BEARER-TOKEN",
	})
	if !connected.Success {
		t.Fatalf("connect failed: %s", connected.Error)
	}

	encoded, err := json.Marshal(service.Sessions())
	if err != nil {
		t.Fatalf("serialise sessions: %v", err)
	}

	var decoded struct {
		Sessions []map[string]any `json:"sessions"`
	}
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("read back sessions: %v", err)
	}
	if len(decoded.Sessions) != 1 {
		t.Fatalf("expected one session, got %d", len(decoded.Sessions))
	}

	allowed := map[string]bool{"id": true, "server": true, "createdAt": true}
	for field := range decoded.Sessions[0] {
		if !allowed[field] {
			t.Fatalf("session info exposes an unexpected field: %q", field)
		}
	}

	server, _ := decoded.Sessions[0]["server"].(string)
	if !strings.Contains(server, "127.0.0.1:6443") {
		t.Fatalf("the server address was lost: %q", server)
	}
	if strings.Contains(server, "SECRET-URL-PASSWORD") {
		t.Fatalf("the server address still carries its password: %q", server)
	}
}

func TestBuildTlsConfigErrorsQuoteNoKeyMaterial(t *testing.T) {
	const key = "-----BEGIN EC PRIVATE KEY-----\nSECRET-KEY-MATERIAL-9d17\n-----END EC PRIVATE KEY-----\n"

	registry := NewSessionRegistry()
	t.Cleanup(registry.Close)

	result := NewConnectionService(registry).Connect(ConnectionSpec{
		Server:        "https://127.0.0.1:6443",
		ClientCertPem: "-----BEGIN CERTIFICATE-----\nbroken\n-----END CERTIFICATE-----\n",
		ClientKeyPem:  key,
	})

	if result.Success {
		t.Fatal("a broken key pair must be rejected")
	}
	if strings.Contains(result.Error, "SECRET-KEY-MATERIAL-9d17") {
		t.Fatalf("the error quotes key material: %q", result.Error)
	}
}
