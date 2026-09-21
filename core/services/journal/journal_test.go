package journal

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func newJournal(t *testing.T, options Options) *Journal {
	t.Helper()

	if options.Dir == "" {
		options.Dir = t.TempDir()
	}

	journal, err := Open(options)
	if err != nil {
		t.Fatalf("journal unavailable: %v", err)
	}
	t.Cleanup(func() { journal.Close() })

	return journal
}

func readLines(t *testing.T, path string) []string {
	t.Helper()

	content, err := os.ReadFile(filepath.FromSlash(path))
	if err != nil {
		t.Fatalf("could not read the journal: %v", err)
	}

	return strings.Split(strings.TrimSpace(string(content)), "\n")
}

func decodeLine(t *testing.T, raw string) map[string]any {
	t.Helper()

	decoded := map[string]any{}
	if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
		t.Fatalf("the journal line is not valid json: %v", err)
	}

	return decoded
}

func TestWriteAppendsOneLinePerEntry(t *testing.T) {
	journal := newJournal(t, Options{})

	entries := []Entry{
		{Level: LevelInfo, Component: "kube", Event: "request", Method: "get", Path: "/api/v1/pods", Status: 200, Session: "a1b2c3", Duration: 12},
		{Level: LevelError, Component: "kube", Event: "request", Method: "DELETE", Path: "/api/v1/pods/web", Status: 500},
	}

	for _, entry := range entries {
		if err := journal.Write(entry); err != nil {
			t.Fatalf("unexpected failure: %v", err)
		}
	}

	lines := readLines(t, journal.Path())
	if len(lines) != 2 {
		t.Fatalf("expected 2 lines, got %d", len(lines))
	}

	first := decodeLine(t, lines[0])
	if first["method"] != "GET" {
		t.Fatalf("expected the method to be normalised, got %v", first["method"])
	}
	if first["status"] != float64(200) || first["path"] != "/api/v1/pods" {
		t.Fatalf("unexpected first line: %v", first)
	}
	if first["time"] == "" || first["level"] != LevelInfo {
		t.Fatalf("unexpected first line: %v", first)
	}
}

func TestWriteRotatesOnSizeAndKeepsTheFileCountCapped(t *testing.T) {
	directory := t.TempDir()
	journal := newJournal(t, Options{Dir: directory, MaxBytes: 256, MaxFiles: 3})

	for index := 0; index < 200; index++ {
		if err := journal.Write(Entry{Level: LevelInfo, Component: "kube", Event: "request", Method: "GET", Path: "/api/v1/pods"}); err != nil {
			t.Fatalf("unexpected failure: %v", err)
		}
	}

	files, err := os.ReadDir(directory)
	if err != nil {
		t.Fatalf("could not read the journal directory: %v", err)
	}

	if len(files) != 3 {
		names := make([]string, 0, len(files))
		for _, file := range files {
			names = append(names, file.Name())
		}
		t.Fatalf("expected 3 files, got %d: %v", len(files), names)
	}

	for _, file := range files {
		info, err := file.Info()
		if err != nil {
			t.Fatalf("could not stat %q: %v", file.Name(), err)
		}
		if info.Size() > 512 {
			t.Fatalf("%q grew past the rotation size: %d bytes", file.Name(), info.Size())
		}
	}
}

func TestRotationLeavesTheNewestEntryInTheLiveFile(t *testing.T) {
	directory := t.TempDir()
	journal := newJournal(t, Options{Dir: directory, MaxBytes: 256, MaxFiles: 3})

	for index := 0; index < 50; index++ {
		journal.Write(Entry{Level: LevelInfo, Component: "kube", Event: "request", Method: "GET", Path: "/api/v1/pods"})
	}

	if err := journal.Write(Entry{Level: LevelWarn, Component: "app", Event: "shutdown"}); err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}

	lines := readLines(t, journal.Path())
	last := decodeLine(t, lines[len(lines)-1])

	if last["event"] != "shutdown" {
		t.Fatalf("expected the newest entry in the live file, got %v", last)
	}
}

func TestWriteReopensAfterClose(t *testing.T) {
	journal := newJournal(t, Options{})

	if err := journal.Write(Entry{Level: LevelInfo, Component: "app", Event: "start"}); err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}
	if err := journal.Close(); err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}
	if err := journal.Write(Entry{Level: LevelInfo, Component: "app", Event: "resume"}); err != nil {
		t.Fatalf("unexpected failure: %v", err)
	}

	if lines := readLines(t, journal.Path()); len(lines) != 2 {
		t.Fatalf("expected 2 lines, got %d", len(lines))
	}
}

func TestRecordWithoutADefaultJournalIsANoOp(t *testing.T) {
	SetDefault(nil)

	Record(Entry{Level: LevelInfo, Component: "app", Event: "start"})
}
