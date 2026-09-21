package storage

type State struct {
	Version int `json:"version"`
}

type Migration struct {
	To    int
	Apply func(root string) error
}

type StorageInfo struct {
	Success bool   `json:"success"`
	Root    string `json:"root"`
	Logs    string `json:"logs"`
	Version int    `json:"version"`
	Error   string `json:"error"`
}
