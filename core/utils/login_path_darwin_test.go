//go:build darwin

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

func TestInheritLoginShellPathTakesThePathTheLoginShellPrints(t *testing.T) {
	t.Setenv("PATH", "/usr/bin:/bin")
	t.Setenv("SHELL", fakeShell(t, `printf 'motd noise\n%s/opt/homebrew/bin:/usr/bin%s' "`+loginPathMarker+`" "`+loginPathMarker+`"`))

	InheritLoginShellPath()

	if got := os.Getenv("PATH"); got != "/opt/homebrew/bin:/usr/bin" {
		t.Fatalf("expected the login shell PATH, got %q", got)
	}
}

func TestInheritLoginShellPathKeepsThePathWhenTheShellFails(t *testing.T) {
	t.Setenv("PATH", "/usr/bin:/bin")
	t.Setenv("SHELL", fakeShell(t, "exit 1"))

	InheritLoginShellPath()

	if got := os.Getenv("PATH"); got != "/usr/bin:/bin" {
		t.Fatalf("expected PATH untouched, got %q", got)
	}
}

func TestInheritLoginShellPathKeepsThePathWhenTheShellPrintsNoMarkers(t *testing.T) {
	t.Setenv("PATH", "/usr/bin:/bin")
	t.Setenv("SHELL", fakeShell(t, "echo /somewhere/else"))

	InheritLoginShellPath()

	if got := os.Getenv("PATH"); got != "/usr/bin:/bin" {
		t.Fatalf("expected PATH untouched, got %q", got)
	}
}

func TestInheritLoginShellPathGivesUpOnAShellThatHangs(t *testing.T) {
	t.Setenv("PATH", "/usr/bin:/bin")
	t.Setenv("SHELL", fakeShell(t, "sleep 30"))

	InheritLoginShellPath()

	if got := os.Getenv("PATH"); got != "/usr/bin:/bin" {
		t.Fatalf("expected PATH untouched, got %q", got)
	}
}
