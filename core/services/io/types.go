package io

type IOOptions struct {
	Mode  string // Binary / Text
	Range string // "start-end" / "start-" / "-end"
}

type IOResult struct {
	Success bool   `json:"success"`
	Data    string `json:"data"`
}
