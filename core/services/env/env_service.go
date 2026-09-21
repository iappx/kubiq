package env

import (
	"os"
	"path/filepath"
	"strings"

	"iappx_k8s_admin/core/utils"
)

type EnvService struct{}

func (s *EnvService) Get(name string) EnvResult {
	key := strings.TrimSpace(name)
	if key == "" {
		return EnvResult{Error: "environment variable name is required"}
	}

	value, found := os.LookupEnv(key)
	if !found {
		return EnvResult{Error: "environment variable is not set: " + key}
	}

	return EnvResult{Success: true, Value: value}
}

func (s *EnvService) UserHomeDir() EnvResult {
	home, err := os.UserHomeDir()
	if err != nil {
		return EnvResult{Error: err.Error()}
	}

	return EnvResult{Success: true, Value: filepath.ToSlash(home)}
}

func (s *EnvService) PathSeparator() EnvResult {
	return EnvResult{Success: true, Value: string(os.PathListSeparator)}
}

func (s *EnvService) Expand(path string) EnvResult {
	value := strings.TrimSpace(path)
	if value == "" {
		return EnvResult{Error: "path is required"}
	}

	value = os.ExpandEnv(expandPercentVars(value))

	value, err := expandHome(value)
	if err != nil {
		return EnvResult{Error: err.Error()}
	}
	if value == "" {
		return EnvResult{Error: "path is empty after expansion: " + path}
	}

	return EnvResult{Success: true, Value: utils.GetPath(value)}
}

func expandPercentVars(value string) string {
	var expanded strings.Builder
	rest := value

	for {
		start := strings.Index(rest, "%")
		if start < 0 {
			break
		}

		end := strings.Index(rest[start+1:], "%")
		if end < 0 {
			break
		}

		name := rest[start+1 : start+1+end]
		expanded.WriteString(rest[:start])

		if name == "" || strings.ContainsAny(name, `/\`) {
			expanded.WriteString("%" + name + "%")
		} else {
			expanded.WriteString(os.Getenv(name))
		}

		rest = rest[start+1+end+1:]
	}

	expanded.WriteString(rest)

	return expanded.String()
}

func expandHome(value string) (string, error) {
	if value != "~" && !strings.HasPrefix(value, "~/") && !strings.HasPrefix(value, `~\`) {
		return value, nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	rest := strings.TrimLeft(value[1:], `/\`)
	if rest == "" {
		return home, nil
	}

	return filepath.Join(home, rest), nil
}
