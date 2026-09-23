package process

const (
	EventStdout = "process:stdout"
	EventStderr = "process:stderr"
	EventExit   = "process:exit"
)

type StartSpec struct {
	Command string   `json:"command"`
	Args    []string `json:"args"`
	// An empty value removes the variable instead of setting it to "".
	Env  map[string]string `json:"env"`
	Dir  string            `json:"dir"`
	Pty  bool              `json:"pty"`
	Cols int               `json:"cols"`
	Rows int               `json:"rows"`
}

type LaunchSpec struct {
	Path string   `json:"path"`
	Args []string `json:"args"`
	Dir  string   `json:"dir"`
}

type StartResult struct {
	Success   bool   `json:"success"`
	ProcessId string `json:"processId"`
	Error     string `json:"error"`
}

type ProcessResult struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

type ProcessInfo struct {
	Id        string `json:"id"`
	Command   string `json:"command"`
	Pty       bool   `json:"pty"`
	StartedAt string `json:"startedAt"`
	Running   bool   `json:"running"`
}

type ProcessListResult struct {
	Success   bool          `json:"success"`
	Processes []ProcessInfo `json:"processes"`
	Error     string        `json:"error"`
}

type StreamEvent struct {
	ProcessId string `json:"processId"`
	// Base64: a chunk boundary may fall inside a UTF-8 sequence.
	Data string `json:"data"`
}

type ExitEvent struct {
	ProcessId string `json:"processId"`
	Code      int    `json:"code"`
}
