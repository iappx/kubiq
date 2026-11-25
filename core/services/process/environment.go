package process

import "strings"

func mergeEnvironment(base []string, overrides map[string]string, empty ...string) []string {
	if len(overrides) == 0 && len(empty) == 0 {
		return base
	}

	pending := make(map[string]string, len(overrides))
	for name, value := range overrides {
		pending[environmentKey(name)] = value
	}

	pendingEmpty := make(map[string]struct{}, len(empty))
	for _, name := range empty {
		if name == "" {
			continue
		}
		key := environmentKey(name)
		delete(pending, key)
		pendingEmpty[key] = struct{}{}
	}

	merged := make([]string, 0, len(base)+len(overrides)+len(empty))

	for _, entry := range base {
		name, _, found := strings.Cut(entry, "=")
		if !found {
			merged = append(merged, entry)
			continue
		}

		key := environmentKey(name)
		if _, asEmpty := pendingEmpty[key]; asEmpty {
			delete(pendingEmpty, key)
			merged = append(merged, name+"=")
			continue
		}

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

	for _, name := range empty {
		if name == "" {
			continue
		}
		key := environmentKey(name)
		if _, unused := pendingEmpty[key]; !unused {
			continue
		}

		delete(pendingEmpty, key)
		merged = append(merged, name+"=")
	}

	return merged
}

func environmentKey(name string) string {
	if environmentCaseInsensitive {
		return strings.ToUpper(name)
	}
	return name
}
