package io

type IOOptions struct {
	Mode  string
	Range string
}

type IOResult struct {
	Success bool   `json:"success"`
	Data    string `json:"data"`
}
