package storage

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func openStore(t *testing.T) *Storage {
	t.Helper()

	store, err := OpenAt(t.TempDir())
	if err != nil {
		t.Fatalf("storage unavailable: %v", err)
	}

	return store
}

func TestOpenAtCreatesTheLogDirectory(t *testing.T) {
	store := openStore(t)

	info, err := os.Stat(filepath.FromSlash(store.LogsDir()))
	if err != nil || !info.IsDir() {
		t.Fatalf("the log directory was not created: %v", err)
	}
}

func TestMigrateStampsAFreshDirectoryWithTheCurrentVersion(t *testing.T) {
	store := openStore(t)

	if version := store.Version(); version != 0 {
		t.Fatalf("expected an unstamped directory, got version %d", version)
	}

	if err := store.Migrate(); err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}

	if version := store.Version(); version != CurrentVersion {
		t.Fatalf("expected version %d, got %d", CurrentVersion, version)
	}
}

func TestVersionFallsBackToDefaultsOnACorruptStateFile(t *testing.T) {
	store := openStore(t)

	if err := os.WriteFile(store.statePath(), []byte("{ this is not json"), storageFilePerm); err != nil {
		t.Fatalf("could not stage a corrupt state file: %v", err)
	}

	if version := store.Version(); version != 0 {
		t.Fatalf("a corrupt file should read as defaults, got version %d", version)
	}

	if err := store.Migrate(); err != nil {
		t.Fatalf("a corrupt file must not fail the migration: %v", err)
	}

	if version := store.Version(); version != CurrentVersion {
		t.Fatalf("expected the stamp to be rewritten as %d, got %d", CurrentVersion, version)
	}
}

func TestApplyRunsPendingStepsInVersionOrder(t *testing.T) {
	store := openStore(t)

	var applied []int
	steps := []Migration{
		{To: 3, Apply: func(string) error { applied = append(applied, 3); return nil }},
		{To: 2, Apply: func(string) error { applied = append(applied, 2); return nil }},
	}

	if err := store.apply(steps); err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}

	if len(applied) != 2 || applied[0] != 2 || applied[1] != 3 {
		t.Fatalf("expected the steps to run in order, got %v", applied)
	}
	if version := store.Version(); version != 3 {
		t.Fatalf("expected version 3, got %d", version)
	}
}

func TestApplySkipsStepsTheDirectoryAlreadyCarries(t *testing.T) {
	store := openStore(t)

	if err := store.apply([]Migration{{To: 2, Apply: func(string) error { return nil }}}); err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}

	replays := 0
	steps := []Migration{
		{To: 2, Apply: func(string) error { replays++; return nil }},
		{To: 3, Apply: func(string) error { return nil }},
	}

	if err := store.apply(steps); err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}

	if replays != 0 {
		t.Fatalf("an applied step ran again %d time(s)", replays)
	}
	if version := store.Version(); version != 3 {
		t.Fatalf("expected version 3, got %d", version)
	}
}

func TestApplyStopsAtTheFirstFailingStep(t *testing.T) {
	store := openStore(t)

	failure := errors.New("migration failed")
	steps := []Migration{
		{To: 2, Apply: func(string) error { return nil }},
		{To: 3, Apply: func(string) error { return failure }},
	}

	if err := store.apply(steps); !errors.Is(err, failure) {
		t.Fatalf("expected the step failure to surface, got %v", err)
	}

	if version := store.Version(); version != 2 {
		t.Fatalf("expected the directory to stay at version 2, got %d", version)
	}
}

func TestApplyPassesTheRootToEveryStep(t *testing.T) {
	store := openStore(t)

	seen := ""
	steps := []Migration{{To: 2, Apply: func(root string) error { seen = root; return nil }}}

	if err := store.apply(steps); err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}

	if seen != store.Root() {
		t.Fatalf("expected the step to receive %q, got %q", store.Root(), seen)
	}
}
