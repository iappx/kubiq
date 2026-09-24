//go:build darwin

package utils

import (
	"context"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"
)

const (
	loginShellTimeout   = 3 * time.Second
	loginShellWaitDelay = time.Second
	defaultLoginShell   = "/bin/zsh"
	loginPathMarker     = "__KUBIQ_LOGIN_PATH__"
)

func InheritLoginShellPath() {
	// Started from Finder or the Dock, the app gets launchd's PATH without Homebrew's directories.
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = defaultLoginShell
	}

	ctx, cancel := context.WithTimeout(context.Background(), loginShellTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, shell, "-ilc", `printf '%s%s%s' "`+loginPathMarker+`" "$PATH" "`+loginPathMarker+`"`)
	cmd.Env = append(os.Environ(), "DISABLE_AUTO_UPDATE=true")
	cmd.WaitDelay = loginShellWaitDelay

	output, err := cmd.Output()
	if err != nil {
		log.Printf("login shell PATH is unavailable: %v", err)
		return
	}

	path := loginPathFrom(string(output))
	if path == "" {
		log.Printf("login shell %s printed no PATH", shell)
		return
	}

	os.Setenv("PATH", path)
}

func loginPathFrom(output string) string {
	parts := strings.Split(output, loginPathMarker)
	if len(parts) < 3 {
		return ""
	}

	return strings.TrimSpace(parts[len(parts)-2])
}
