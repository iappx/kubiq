package utils

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func userProfile(t *testing.T) string {
	t.Helper()

	base := t.TempDir()
	t.Setenv("AppData", base)
	t.Setenv("XDG_CONFIG_HOME", base)
	t.Setenv("HOME", base)

	return filepath.ToSlash(base)
}

func TestUserDataDirIsCreatedInsideTheUserProfile(t *testing.T) {
	base := userProfile(t)

	dir, err := UserDataDir()
	if err != nil {
		t.Fatalf("user data directory unavailable: %v", err)
	}

	if !strings.HasPrefix(dir, base) {
		t.Fatalf("expected %q inside %q", dir, base)
	}
	if filepath.Base(dir) != AppDirName {
		t.Fatalf("expected the %q folder, got %q", AppDirName, dir)
	}

	info, err := os.Stat(filepath.FromSlash(dir))
	if err != nil || !info.IsDir() {
		t.Fatalf("the first run did not create %q: %v", dir, err)
	}
}

func TestResolvePathAddressesTheUserDataRoot(t *testing.T) {
	userProfile(t)

	root, err := UserDataDir()
	if err != nil {
		t.Fatalf("user data directory unavailable: %v", err)
	}

	resolved, err := ResolvePath(UserDataScheme + "logs/kubiq.log")
	if err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}

	expected := root + "/" + LogsDirName + "/kubiq.log"
	if resolved != expected {
		t.Fatalf("expected %q, got %q", expected, resolved)
	}
}

func TestResolvePathWithoutASchemeStaysNextToTheExecutable(t *testing.T) {
	userProfile(t)

	executable, err := os.Executable()
	if err != nil {
		t.Fatalf("executable path unavailable: %v", err)
	}

	resolved, err := ResolvePath("data/clusters.json")
	if err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}

	expected := filepath.ToSlash(filepath.Join(filepath.Dir(executable), "data/clusters.json"))
	if resolved != expected {
		t.Fatalf("expected %q, got %q", expected, resolved)
	}
}

func TestResolvePathKeepsAbsolutePaths(t *testing.T) {
	absolute := filepath.Join(t.TempDir(), "clusters.json")

	resolved, err := ResolvePath(absolute)
	if err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}

	if resolved != filepath.ToSlash(absolute) {
		t.Fatalf("expected %q, got %q", filepath.ToSlash(absolute), resolved)
	}
}
