package env

type EnvResult struct {
	Success bool   `json:"success"`
	Value   string `json:"value"`
	Error   string `json:"error"`
}
