package download

const (
	EventProgress = "download:progress"
	EventDone     = "download:done"
)

type DownloadSpec struct {
	Url     string            `json:"url"`
	Path    string            `json:"path"`
	Headers map[string]string `json:"headers"`
}

type StartResult struct {
	Success    bool   `json:"success"`
	DownloadId string `json:"downloadId"`
	Error      string `json:"error"`
}

type DownloadResult struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

type ProgressEvent struct {
	DownloadId string `json:"downloadId"`
	Received   int64  `json:"received"`
	// Zero when the server does not announce a length.
	Total int64 `json:"total"`
}

type DoneEvent struct {
	DownloadId string `json:"downloadId"`
	Success    bool   `json:"success"`
	Cancelled  bool   `json:"cancelled"`
	Path       string `json:"path"`
	Size       int64  `json:"size"`
	Sha256     string `json:"sha256"`
	Error      string `json:"error"`
}
