package kube

const journalComponent = "kube"

const (
	EventStreamChunk = "kube:stream:chunk"
	EventStreamError = "kube:stream:error"
	EventStreamClose = "kube:stream:close"
)

const (
	StreamModeLines = "lines"
	StreamModeRaw   = "raw"
)

const (
	StreamStatusEof     = "eof"
	StreamStatusStopped = "stopped"
	StreamStatusError   = "error"
)

type ConnectionSpec struct {
	Server                string `json:"server"`
	CaPem                 string `json:"caPem"`
	ClientCertPem         string `json:"clientCertPem"`
	ClientKeyPem          string `json:"clientKeyPem"`
	Token                 string `json:"token"`
	Username              string `json:"username"`
	Password              string `json:"password"`
	InsecureSkipTlsVerify bool   `json:"insecureSkipTlsVerify"`
	ServerName            string `json:"serverName"`
	ProxyUrl              string `json:"proxyUrl"`
	TimeoutSeconds        int    `json:"timeoutSeconds"`
}

type ConnectResult struct {
	Success   bool   `json:"success"`
	SessionId string `json:"sessionId"`
	Error     string `json:"error"`
}

type KubeResult struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

type SessionInfo struct {
	Id        string `json:"id"`
	Server    string `json:"server"`
	CreatedAt string `json:"createdAt"`
}

type SessionsResult struct {
	Success  bool          `json:"success"`
	Sessions []SessionInfo `json:"sessions"`
	Error    string        `json:"error"`
}

type Request struct {
	SessionId      string            `json:"sessionId"`
	Method         string            `json:"method"`
	Path           string            `json:"path"`
	Headers        map[string]string `json:"headers"`
	Body           string            `json:"body"`
	TimeoutSeconds int               `json:"timeoutSeconds"`
}

type Response struct {
	Success bool              `json:"success"`
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
	Error   string            `json:"error"`
}

type StreamRequest struct {
	SessionId string            `json:"sessionId"`
	Method    string            `json:"method"`
	Path      string            `json:"path"`
	Headers   map[string]string `json:"headers"`
	Body      string            `json:"body"`
	Mode      string            `json:"mode"`
}

type StreamResult struct {
	Success  bool   `json:"success"`
	StreamId string `json:"streamId"`
	Error    string `json:"error"`
}

type StreamInfo struct {
	Id        string `json:"id"`
	SessionId string `json:"sessionId"`
	Path      string `json:"path"`
	Mode      string `json:"mode"`
	StartedAt string `json:"startedAt"`
}

type StreamsResult struct {
	Success bool         `json:"success"`
	Streams []StreamInfo `json:"streams"`
	Error   string       `json:"error"`
}

type StreamChunkEvent struct {
	StreamId string `json:"streamId"`
	Data     string `json:"data"`
}

type StreamErrorEvent struct {
	StreamId string `json:"streamId"`
	Error    string `json:"error"`
}

type StreamCloseEvent struct {
	StreamId string `json:"streamId"`
	Status   string `json:"status"`
}
