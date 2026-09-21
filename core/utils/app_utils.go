package utils

import (
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func GetPath(path string) string {
	resolved, err := ResolvePath(path)
	if err != nil {
		panic(err)
	}
	return resolved
}

func ResolvePath(path string) (string, error) {
	if rest, found := strings.CutPrefix(path, UserDataScheme); found {
		root, err := UserDataDir()
		if err != nil {
			return "", err
		}
		return clean(filepath.Join(root, filepath.FromSlash(rest))), nil
	}

	if filepath.IsAbs(path) {
		return clean(path), nil
	}

	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}

	return clean(filepath.Join(filepath.Dir(exePath), path)), nil
}

func clean(path string) string {
	return filepath.ToSlash(filepath.Clean(path))
}

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

	if startStr != "" && endStr == "" {
		start, err = strconv.ParseInt(startStr, 10, 64)
		if err != nil || start < 0 {
			return 0, 0, errors.New("invalid range value")
		}
		end = size - 1
		return start, end, nil
	}

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
