package journal

type Entry struct {
	Level     string `json:"level"`
	Component string `json:"component"`
	Event     string `json:"event"`
	Method    string `json:"method"`
	Path      string `json:"path"`
	Status    int    `json:"status"`
	Session   string `json:"session"`
	Duration  int64  `json:"duration"`
	Message   string `json:"message"`
	Trace     string `json:"trace"`
}

type JournalResult struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

type Options struct {
	Dir      string
	FileName string
	MaxBytes int64
	MaxFiles int
}
