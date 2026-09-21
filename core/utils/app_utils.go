package utils

import (
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// GetPath resolves path against the executable's directory when it is relative,
// so a packaged app reads and writes next to its own binary rather than next to
// whatever the current working directory happens to be.
func GetPath(path string) string {
	if !filepath.IsAbs(path) {
		exePath, err := os.Executable()
		if err != nil {
			panic(err)
		}
		path = filepath.Join(filepath.Dir(exePath), path)
	}
	return filepath.ToSlash(filepath.Clean(path))
}

// ParseRange parses an HTTP-style byte range ("bytes=100-200", "100-", "-200")
// against a known size and returns the inclusive start/end offsets. An empty
// string means the whole file.
func ParseRange(s string, size int64) (start int64, end int64, err error) {
	if s == "" {
		return 0, size - 1, nil
	}

	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "bytes=")

	parts := strings.SplitN(s, "-", 2)
	if len(parts) != 2 {
		return 0, 0, errors.New("invalid range format")
	}

	startStr := strings.TrimSpace(parts[0])
	endStr := strings.TrimSpace(parts[1])

	// "-200" — last 200 bytes
	if startStr == "" && endStr != "" {
		e, err2 := strconv.ParseInt(endStr, 10, 64)
		if err2 != nil || e < 0 {
			return 0, 0, errors.New("invalid range value")
		}
		if e > size {
			start = 0
		} else {
			start = size - e
		}
		end = size - 1
		return start, end, nil
	}

	// "100-" — from start to EOF
	if startStr != "" && endStr == "" {
		start, err = strconv.ParseInt(startStr, 10, 64)
		if err != nil || start < 0 {
			return 0, 0, errors.New("invalid range value")
		}
		end = size - 1
		return start, end, nil
	}

	// "100-200"
	if startStr != "" && endStr != "" {
		start, err = strconv.ParseInt(startStr, 10, 64)
		if err != nil || start < 0 {
			return 0, 0, errors.New("invalid range value")
		}
		end, err = strconv.ParseInt(endStr, 10, 64)
		if err != nil || end < 0 {
			return 0, 0, errors.New("invalid range value")
		}
		if start > end {
			return 0, 0, errors.New("invalid range: start > end")
		}
		if end >= size {
			end = size - 1
		}
		return start, end, nil
	}

	return 0, 0, errors.New("invalid range format")
}
