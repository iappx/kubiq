//go:build darwin || linux

package utils

import (
	"context"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

const (
	loginShellTimeout   = 3 * time.Second
	loginShellWaitDelay = time.Second
	darwinLoginShell    = "/bin/zsh"
	fallbackLoginShell  = "/bin/sh"
	loginEnvMarker      = "__KUBIQ_LOGIN_ENV__"
	kubeconfigVariable  = "KUBECONFIG"
)

func InheritLoginShellEnv() {
	// Started from Finder, the Dock or a desktop launcher, the app misses what the shell profile exports.
	shell := loginShell()

	ctx, cancel := context.WithTimeout(context.Background(), loginShellTimeout)
	defer cancel()

	script := `printf '%s%s%s%s%s' "` + loginEnvMarker + `" "$PATH" "` + loginEnvMarker + `" "$` + kubeconfigVariable + `" "` + loginEnvMarker + `"`
	cmd := exec.CommandContext(ctx, shell, "-ilc", script)
	cmd.Env = append(os.Environ(), "DISABLE_AUTO_UPDATE=true")
	cmd.WaitDelay = loginShellWaitDelay

	output, err := cmd.Output()
	if err != nil {
		log.Printf("login shell environment is unavailable: %v", err)
		return
	}

	path, kubeconfig, found := loginEnvFrom(string(output))
	if !found || path == "" {
		log.Printf("login shell %s printed no PATH", shell)
		return
	}

	os.Setenv("PATH", path)

	// A KUBECONFIG the app was started with was chosen for this run and wins over the profile.
	if _, set := os.LookupEnv(kubeconfigVariable); !set && kubeconfig != "" {
		os.Setenv(kubeconfigVariable, kubeconfig)
	}
}

func loginShell() string {
	if shell := os.Getenv("SHELL"); shell != "" {
		return shell
	}

	if runtime.GOOS == "darwin" {
		return darwinLoginShell
	}

	return fallbackLoginShell
}

func loginEnvFrom(output string) (path string, kubeconfig string, found bool) {
	parts := strings.Split(output, loginEnvMarker)
	if len(parts) < 4 {
		return "", "", false
	}

	return strings.TrimSpace(parts[len(parts)-3]), strings.TrimSpace(parts[len(parts)-2]), true
}
