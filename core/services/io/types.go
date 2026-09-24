package io

type IOOptions struct {
	Mode  string
	Range string
}

type IOResult struct {
	Success bool   `json:"success"`
	Data    string `json:"data"`
}

type FileEntry struct {
	Path       string `json:"path"`
	Name       string `json:"name"`
	IsDir      bool   `json:"isDir"`
	Size       int64  `json:"size"`
	ModifiedAt int64  `json:"modifiedAt"`
}

type DirListResult struct {
	Success bool        `json:"success"`
	Entries []FileEntry `json:"entries"`
	Error   string      `json:"error"`
}

type StatResult struct {
	Success bool      `json:"success"`
	Exists  bool      `json:"exists"`
	Entry   FileEntry `json:"entry"`
	Error   string    `json:"error"`
}
