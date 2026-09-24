package io

import (
	"os"
	"path/filepath"
	"sort"
	"testing"
)

func TestListDirReportsFilesAndFolders(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "config"), []byte("apiVersion: v1\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(dir, "cache"), 0o755); err != nil {
		t.Fatal(err)
	}

	result := (&IoService{}).ListDir(dir)

	if !result.Success {
		t.Fatalf("expected success, got %q", result.Error)
	}

	sort.Slice(result.Entries, func(i, j int) bool { return result.Entries[i].Name < result.Entries[j].Name })

	if len(result.Entries) != 2 {
		t.Fatalf("expected two entries, got %d", len(result.Entries))
	}

	cache, config := result.Entries[0], result.Entries[1]
	if cache.Name != "cache" || !cache.IsDir {
		t.Fatalf("expected the cache folder, got %+v", cache)
	}
	if config.Name != "config" || config.IsDir || config.Size != 15 || config.ModifiedAt == 0 {
		t.Fatalf("expected the config file, got %+v", config)
	}
	if config.Path != filepath.ToSlash(filepath.Join(dir, "config")) {
		t.Fatalf("expected an absolute slash path, got %q", config.Path)
	}
}

func TestListDirReportsAnEmptyFolderAsNoEntries(t *testing.T) {
	result := (&IoService{}).ListDir(t.TempDir())

	if !result.Success || result.Entries == nil || len(result.Entries) != 0 {
		t.Fatalf("expected an empty list, got %+v", result)
	}
}

func TestListDirFailsOnAMissingFolder(t *testing.T) {
	result := (&IoService{}).ListDir(filepath.Join(t.TempDir(), "gone"))

	if result.Success || result.Error == "" {
		t.Fatalf("expected a failure, got %+v", result)
	}
}

func TestStatDescribesAnExistingFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "staging.yaml")
	if err := os.WriteFile(path, []byte("kind: Config\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	result := (&IoService{}).Stat(path)

	if !result.Success || !result.Exists || result.Entry.IsDir || result.Entry.Size != 13 {
		t.Fatalf("expected the file, got %+v", result)
	}
}

func TestStatReportsAMissingFileAsAbsentRatherThanFailed(t *testing.T) {
	result := (&IoService{}).Stat(filepath.Join(t.TempDir(), "gone.yaml"))

	if !result.Success || result.Exists {
		t.Fatalf("expected an absent file, got %+v", result)
	}
}
