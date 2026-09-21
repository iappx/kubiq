package process

import "strings"

func mergeEnvironment(base []string, overrides map[string]string) []string {
	if len(overrides) == 0 {
		return base
	}

	pending := make(map[string]string, len(overrides))
	for name, value := range overrides {
		pending[environmentKey(name)] = value
	}

	merged := make([]string, 0, len(base)+len(overrides))

	for _, entry := range base {
		name, _, found := strings.Cut(entry, "=")
		if !found {
			merged = append(merged, entry)
			continue
		}

		key := environmentKey(name)
		value, replaced := pending[key]
		if !replaced {
			merged = append(merged, entry)
			continue
		}

		delete(pending, key)
		if value != "" {
			merged = append(merged, name+"="+value)
		}
	}

	for name, value := range overrides {
		key := environmentKey(name)
		if _, unused := pending[key]; !unused {
			continue
		}

		delete(pending, key)
		if value != "" {
			merged = append(merged, name+"="+value)
		}
	}

	return merged
}

func environmentKey(name string) string {
	if environmentCaseInsensitive {
		return strings.ToUpper(name)
	}
	return name
}
