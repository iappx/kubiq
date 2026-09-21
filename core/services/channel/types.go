package channel

const (
	EventChannelData  = "kube:channel:data"
	EventChannelError = "kube:channel:error"
	EventChannelClose = "kube:channel:close"
	EventForwardError = "kube:forward:error"
	EventForwardClose = "kube:forward:close"
)

const (
	StreamStdout = "stdout"
	StreamStderr = "stderr"
)

const (
	StatusEof    = "eof"
	StatusClosed = "closed"
	StatusError  = "error"
)

type ChannelSpec struct {
	SessionId    string            `json:"sessionId"`
	Path         string            `json:"path"`
	Subprotocols []string          `json:"subprotocols"`
	Headers      map[string]string `json:"headers"`
	Tty          bool              `json:"tty"`
	Cols         int               `json:"cols"`
	Rows         int               `json:"rows"`
}

type ChannelResult struct {
	Success   bool   `json:"success"`
	ChannelId string `json:"channelId"`
	Error     string `json:"error"`
}

type ChannelActionResult struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

type ChannelInfo struct {
	Id        string `json:"id"`
	SessionId string `json:"sessionId"`
	Path      string `json:"path"`
	Tty       bool   `json:"tty"`
	StartedAt string `json:"startedAt"`
}

type ChannelsResult struct {
	Success  bool          `json:"success"`
	Channels []ChannelInfo `json:"channels"`
	Error    string        `json:"error"`
}

type PortForwardSpec struct {
	SessionId    string            `json:"sessionId"`
	Path         string            `json:"path"`
	Subprotocols []string          `json:"subprotocols"`
	Headers      map[string]string `json:"headers"`
	LocalPort    int               `json:"localPort"`
	LocalAddress string            `json:"localAddress"`
	RemotePort   int               `json:"remotePort"`
}

type PortForwardResult struct {
	Success   bool   `json:"success"`
	ForwardId string `json:"forwardId"`
	LocalPort int    `json:"localPort"`
	Error     string `json:"error"`
}

type ForwardInfo struct {
	Id           string `json:"id"`
	SessionId    string `json:"sessionId"`
	LocalAddress string `json:"localAddress"`
	LocalPort    int    `json:"localPort"`
	RemotePort   int    `json:"remotePort"`
	Connections  int    `json:"connections"`
}

type ForwardsResult struct {
	Success  bool          `json:"success"`
	Forwards []ForwardInfo `json:"forwards"`
	Error    string        `json:"error"`
}

type ChannelDataEvent struct {
	ChannelId string `json:"channelId"`
	Stream    string `json:"stream"`
	Data      string `json:"data"`
}

type ChannelErrorEvent struct {
	ChannelId string `json:"channelId"`
	Error     string `json:"error"`
}

type ChannelCloseEvent struct {
	ChannelId string `json:"channelId"`
	Status    string `json:"status"`
	Reason    string `json:"reason"`
}

type ForwardErrorEvent struct {
	ForwardId string `json:"forwardId"`
	Error     string `json:"error"`
}

type ForwardCloseEvent struct {
	ForwardId string `json:"forwardId"`
	Status    string `json:"status"`
}
