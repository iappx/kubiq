package kube

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"
)

type recordedEvent struct {
	name string
	data any
}

type recordingEmitter struct {
	mutex  sync.Mutex
	events []recordedEvent
}

func (e *recordingEmitter) Emit(name string, data any) {
	e.mutex.Lock()
	defer e.mutex.Unlock()

	e.events = append(e.events, recordedEvent{name: name, data: data})
}

func (e *recordingEmitter) snapshot() []recordedEvent {
	e.mutex.Lock()
	defer e.mutex.Unlock()

	return append([]recordedEvent(nil), e.events...)
}

func (e *recordingEmitter) chunks(streamId string) []string {
	var data []string
	for _, event := range e.snapshot() {
		chunk, ok := event.data.(StreamChunkEvent)
		if event.name == EventStreamChunk && ok && chunk.StreamId == streamId {
			data = append(data, chunk.Data)
		}
	}
	return data
}

func (e *recordingEmitter) closeStatus(streamId string) (string, bool) {
	for _, event := range e.snapshot() {
		closed, ok := event.data.(StreamCloseEvent)
		if event.name == EventStreamClose && ok && closed.StreamId == streamId {
			return closed.Status, true
		}
	}
	return "", false
}

func (e *recordingEmitter) errors(streamId string) []string {
	var messages []string
	for _, event := range e.snapshot() {
		failure, ok := event.data.(StreamErrorEvent)
		if event.name == EventStreamError && ok && failure.StreamId == streamId {
			messages = append(messages, failure.Error)
		}
	}
	return messages
}

func (e *recordingEmitter) await(t *testing.T, reason string, condition func() bool) {
	t.Helper()

	deadline := time.Now().Add(10 * time.Second)
	for {
		if condition() {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s (%d events recorded)", reason, len(e.snapshot()))
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func newTestService(t *testing.T) (*KubeService, *SessionRegistry, *recordingEmitter) {
	t.Helper()

	registry := NewSessionRegistry()
	t.Cleanup(registry.Close)

	emitter := &recordingEmitter{}
	service := NewKubeService(registry)
	service.emitter = emitter
	t.Cleanup(service.stopAll)

	return service, registry, emitter
}

func connect(t *testing.T, registry *SessionRegistry, spec ConnectionSpec) string {
	t.Helper()

	result := NewConnectionService(registry).Connect(spec)
	if !result.Success {
		t.Fatalf("connect failed: %s", result.Error)
	}

	return result.SessionId
}

func connectToServer(t *testing.T, registry *SessionRegistry, server *httptest.Server) string {
	t.Helper()

	return connect(t, registry, ConnectionSpec{
		Server: server.URL,
		CaPem:  encodePem("CERTIFICATE", server.Certificate().Raw),
	})
}

func newTlsServer(t *testing.T, handler http.HandlerFunc) *httptest.Server {
	t.Helper()

	server := httptest.NewTLSServer(handler)
	t.Cleanup(server.Close)

	return server
}

func newIdleStreamServer(t *testing.T) *httptest.Server {
	t.Helper()

	return newTlsServer(t, func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusOK)
		writer.(http.Flusher).Flush()
		<-request.Context().Done()
	})
}

func waitForGoroutines(t *testing.T, baseline int) {
	t.Helper()

	deadline := time.Now().Add(10 * time.Second)
	for {
		current := runtime.NumGoroutine()
		if current <= baseline+2 {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("goroutines leaked: %d at start, %d after shutdown", baseline, current)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

type testAuthority struct {
	certificate *x509.Certificate
	key         *ecdsa.PrivateKey
	pem         string
}

type testKeyPair struct {
	certificatePem string
	keyPem         string
}

func (p testKeyPair) tlsCertificate(t *testing.T) tls.Certificate {
	t.Helper()

	certificate, err := tls.X509KeyPair([]byte(p.certificatePem), []byte(p.keyPem))
	if err != nil {
		t.Fatalf("load test key pair: %v", err)
	}

	return certificate
}

func newTestAuthority(t *testing.T) testAuthority {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate authority key: %v", err)
	}

	template := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "iappx-test-authority"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}

	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("create authority certificate: %v", err)
	}

	certificate, err := x509.ParseCertificate(der)
	if err != nil {
		t.Fatalf("parse authority certificate: %v", err)
	}

	return testAuthority{certificate: certificate, key: key, pem: encodePem("CERTIFICATE", der)}
}

func (a testAuthority) issue(t *testing.T, commonName string, hosts []string, usage x509.ExtKeyUsage) testKeyPair {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key for %s: %v", commonName, err)
	}

	template := &x509.Certificate{
		SerialNumber: big.NewInt(time.Now().UnixNano()),
		Subject:      pkix.Name{CommonName: commonName},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:  []x509.ExtKeyUsage{usage},
	}

	for _, host := range hosts {
		if address := net.ParseIP(host); address != nil {
			template.IPAddresses = append(template.IPAddresses, address)
			continue
		}
		template.DNSNames = append(template.DNSNames, host)
	}

	der, err := x509.CreateCertificate(rand.Reader, template, a.certificate, &key.PublicKey, a.key)
	if err != nil {
		t.Fatalf("create certificate for %s: %v", commonName, err)
	}

	encodedKey, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		t.Fatalf("encode key for %s: %v", commonName, err)
	}

	return testKeyPair{
		certificatePem: encodePem("CERTIFICATE", der),
		keyPem:         encodePem("EC PRIVATE KEY", encodedKey),
	}
}

func (a testAuthority) pool(t *testing.T) *x509.CertPool {
	t.Helper()

	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM([]byte(a.pem)) {
		t.Fatal("authority pem is not usable")
	}

	return pool
}

func encodePem(blockType string, der []byte) string {
	return string(pem.EncodeToMemory(&pem.Block{Type: blockType, Bytes: der}))
}

func longestLine(value string) string {
	longest := ""
	for _, line := range strings.Split(value, "\n") {
		if len(line) > len(longest) {
			longest = line
		}
	}
	return longest
}
