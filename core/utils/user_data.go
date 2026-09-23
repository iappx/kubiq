package utils

import (
	"os"
	"path/filepath"
)

const (
	LogsDirName    = "logs"
	UserDataScheme = "userdata:"

	userDataPerm = 0o700
)

func UserDataDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	dir := filepath.Join(base, AppDirName)
	if err := os.MkdirAll(dir, userDataPerm); err != nil {
		return "", err
	}

	return clean(dir), nil
}
