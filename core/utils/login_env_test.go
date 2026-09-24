//go:build darwin || linux

package utils

import (
	"os"
	"path/filepath"
	"testing"
)

func fakeShell(t *testing.T, script string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "shell")
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"+script+"\n"), 0o755); err != nil {
		t.Fatalf("fake shell unavailable: %v", err)
	}

	return path
}

func printedEnv(path string, kubeconfig string) string {
	return `printf 'motd noise\n%s` + path + `%s` + kubeconfig + `%s' "` + loginEnvMarker + `" "` + loginEnvMarker + `" "` + loginEnvMarker + `"`
}

func unsetKubeconfig(t *testing.T) {
	t.Helper()

	t.Setenv(kubeconfigVariable, "")
	os.Unsetenv(kubeconfigVariable)
}

func TestInheritLoginShellEnvTakesThePathTheLoginShellPrints(t *testing.T) {
	unsetKubeconfig(t)
	t.Setenv("PATH", "/usr/bin:/bin")
	t.Setenv("SHELL", fakeShell(t, printedEnv("/opt/homebrew/bin:/usr/bin", "")))

	InheritLoginShellEnv()

	if got := os.Getenv("PATH"); got != "/opt/homebrew/bin:/usr/bin" {
		t.Fatalf("expected the login shell PATH, got %q", got)
	}
}

func TestInheritLoginShellEnvTakesTheKubeconfigTheProfileExports(t *testing.T) {
	unsetKubeconfig(t)
	t.Setenv("PATH", "/usr/bin:/bin")
	t.Setenv("SHELL", fakeShell(t, printedEnv("/usr/bin", "/home/tester/configs/a:/home/tester/configs/b:")))

	InheritLoginShellEnv()

	if got := os.Getenv(kubeconfigVariable); got != "/home/tester/configs/a:/home/tester/configs/b:" {
		t.Fatalf("expected the login shell KUBECONFIG, got %q", got)
	}
}

func TestInheritLoginShellEnvKeepsTheKubeconfigTheAppWasStartedWith(t *testing.T) {
	t.Setenv(kubeconfigVariable, "/tmp/chosen")
	t.Setenv("PATH", "/usr/bin:/bin")
	t.Setenv("SHELL", fakeShell(t, printedEnv("/usr/bin", "/home/tester/profile")))

	InheritLoginShellEnv()

	if got := os.Getenv(kubeconfigVariable); got != "/tmp/chosen" {
		t.Fatalf("expected KUBECONFIG untouched, got %q", got)
	}
}

func TestInheritLoginShellEnvLeavesKubeconfigUnsetWhenTheProfileHasNone(t *testing.T) {
	unsetKubeconfig(t)
	t.Setenv("PATH", "/usr/bin:/bin")
	t.Setenv("SHELL", fakeShell(t, printedEnv("/usr/bin", "")))

	InheritLoginShellEnv()

	if _, set := os.LookupEnv(kubeconfigVariable); set {
		t.Fatalf("expected KUBECONFIG to stay unset")
	}
}

func TestInheritLoginShellEnvKeepsThePathWhenTheShellFails(t *testing.T) {
	t.Setenv("PATH", "/usr/bin:/bin")
	t.Setenv("SHELL", fakeShell(t, "exit 1"))

	InheritLoginShellEnv()

	if got := os.Getenv("PATH"); got != "/usr/bin:/bin" {
		t.Fatalf("expected PATH untouched, got %q", got)
	}
}

func TestInheritLoginShellEnvKeepsThePathWhenTheShellPrintsNoMarkers(t *testing.T) {
	t.Setenv("PATH", "/usr/bin:/bin")
	t.Setenv("SHELL", fakeShell(t, "echo /somewhere/else"))

	InheritLoginShellEnv()

	if got := os.Getenv("PATH"); got != "/usr/bin:/bin" {
		t.Fatalf("expected PATH untouched, got %q", got)
	}
}

func TestInheritLoginShellEnvGivesUpOnAShellThatHangs(t *testing.T) {
	t.Setenv("PATH", "/usr/bin:/bin")
	t.Setenv("SHELL", fakeShell(t, "sleep 30"))

	InheritLoginShellEnv()

	if got := os.Getenv("PATH"); got != "/usr/bin:/bin" {
		t.Fatalf("expected PATH untouched, got %q", got)
	}
}
