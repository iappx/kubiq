package process

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"
)

func childSpec(mode string) StartSpec {
	return StartSpec{
		Command: os.Args[0],
		Env:     map[string]string{childModeEnv: mode},
	}
}

func start(t *testing.T, service *ProcessService, spec StartSpec) string {
	t.Helper()

	result := service.Start(spec)
	if !result.Success {
		if strings.Contains(result.Error, "unsupported platform") {
			t.Skipf("pty is not supported here: %s", result.Error)
		}
		t.Fatalf("start failed: %s", result.Error)
	}

	return result.ProcessId
}

func TestStartStreamsStdoutInChunks(t *testing.T) {
	service, sink := newRecordedService()
	defer service.CloseAll()

	id := start(t, service, childSpec("bulk"))

	if code := sink.awaitExit(t, id); code != 0 {
		t.Fatalf("exit code = %d, want 0", code)
	}

	output, chunks := sink.stream(t, EventStdout, id)

	if chunks < 2 {
		t.Fatalf("stdout arrived in %d chunks, want more than one", chunks)
	}

	expected := bulkPayload()
	if output != expected {
		t.Fatalf("stdout assembled to %d bytes, want %d", len(output), len(expected))
	}
}

func TestStartKeepsStderrOnItsOwnEvent(t *testing.T) {
	service, sink := newRecordedService()
	defer service.CloseAll()

	id := start(t, service, childSpec("echo"))

	sink.awaitOutput(t, id, greetingMarker)

	if result := service.Write(id, base64.StdEncoding.EncodeToString([]byte("quit\n"))); !result.Success {
		t.Fatalf("write failed: %s", result.Error)
	}

	sink.awaitExit(t, id)

	stdout, _ := sink.stream(t, EventStdout, id)
	if strings.Contains(stdout, stderrMarker) {
		t.Fatalf("stdout contains the stderr marker: %q", stdout)
	}

	stderr, _ := sink.stream(t, EventStderr, id)
	if !strings.Contains(stderr, stderrMarker) {
		t.Fatalf("stderr = %q, want it to contain %q", stderr, stderrMarker)
	}
}

func TestWriteReachesStdin(t *testing.T) {
	service, sink := newRecordedService()
	defer service.CloseAll()

	id := start(t, service, childSpec("echo"))
	sink.awaitOutput(t, id, greetingMarker)

	if result := service.Write(id, base64.StdEncoding.EncodeToString([]byte("hello\n"))); !result.Success {
		t.Fatalf("write failed: %s", result.Error)
	}

	sink.awaitOutput(t, id, "echo:hello")

	if result := service.Write(id, base64.StdEncoding.EncodeToString([]byte("quit\n"))); !result.Success {
		t.Fatalf("write failed: %s", result.Error)
	}

	if code := sink.awaitExit(t, id); code != 0 {
		t.Fatalf("exit code = %d, want 0", code)
	}
}

func TestWriteRejectsInvalidBase64(t *testing.T) {
	service, sink := newRecordedService()
	defer service.CloseAll()

	id := start(t, service, childSpec("echo"))
	sink.awaitOutput(t, id, greetingMarker)

	result := service.Write(id, "not base64!")
	if result.Success || result.Error == "" {
		t.Fatalf("write of invalid base64 = %+v, want a failure", result)
	}
}

func TestWriteToFinishedProcessFails(t *testing.T) {
	service, sink := newRecordedService()
	defer service.CloseAll()

	spec := childSpec("exit")
	spec.Env[childExitCodeEnv] = "0"

	id := start(t, service, spec)
	sink.awaitExit(t, id)

	result := service.Write(id, base64.StdEncoding.EncodeToString([]byte("hello\n")))
	if result.Success || result.Error == "" {
		t.Fatalf("write to a finished process = %+v, want a failure", result)
	}
}

func TestExitCodeIsReportedOnce(t *testing.T) {
	for _, expected := range []int{0, 7} {
		service, sink := newRecordedService()

		spec := childSpec("exit")
		spec.Env[childExitCodeEnv] = strconv.Itoa(expected)

		id := start(t, service, spec)

		if code := sink.awaitExit(t, id); code != expected {
			t.Fatalf("exit code = %d, want %d", code, expected)
		}

		time.Sleep(200 * time.Millisecond)

		if codes := sink.exits(id); len(codes) != 1 {
			t.Fatalf("exit events = %v, want exactly one", codes)
		}

		service.CloseAll()
	}
}

func TestKillStopsProcessAndClearsRegistry(t *testing.T) {
	service, sink := newRecordedService()
	defer service.CloseAll()

	id := start(t, service, childSpec("sleep"))
	sink.awaitOutput(t, id, readyMarker)

	listed := service.List()
	if !listed.Success || len(listed.Processes) != 1 || listed.Processes[0].Id != id {
		t.Fatalf("list before kill = %+v, want the running process", listed)
	}
	if !listed.Processes[0].Running {
		t.Fatalf("process %s is listed as not running", id)
	}

	if result := service.Kill(id); !result.Success {
		t.Fatalf("kill failed: %s", result.Error)
	}

	if listed := service.List(); len(listed.Processes) != 0 {
		t.Fatalf("list after kill = %+v, want it empty", listed.Processes)
	}

	if codes := sink.exits(id); len(codes) != 1 {
		t.Fatalf("exit events after kill = %v, want exactly one", codes)
	}

	if result := service.Kill(id); result.Success {
		t.Fatalf("second kill = %+v, want a failure", result)
	}
}

func TestKillStopsTheWholeTree(t *testing.T) {
	service, sink := newRecordedService()
	defer service.CloseAll()

	heartbeat := filepath.Join(t.TempDir(), "heartbeat")

	spec := childSpec("tree")
	spec.Env[childHeartbeatEnv] = heartbeat

	id := start(t, service, spec)
	sink.awaitOutput(t, id, readyMarker)

	sink.await(t, func() bool {
		beats, _ := os.ReadFile(heartbeat)
		return len(beats) >= 3
	}, "the grandchild to start beating")

	if result := service.Kill(id); !result.Success {
		t.Fatalf("kill failed: %s", result.Error)
	}

	settled, _ := os.ReadFile(heartbeat)
	time.Sleep(500 * time.Millisecond)

	after, _ := os.ReadFile(heartbeat)
	if len(after) != len(settled) {
		t.Fatalf("grandchild kept beating after the tree was killed: %d -> %d", len(settled), len(after))
	}
}

func TestPtyStreamsOutputAndSurvivesResize(t *testing.T) {
	service, sink := newRecordedService()
	defer service.CloseAll()

	spec := childSpec("ticks")
	spec.Env[childTicksEnv] = "200"
	spec.Pty = true
	spec.Cols = 80
	spec.Rows = 24

	id := start(t, service, spec)
	sink.awaitOutput(t, id, "TICK1")

	if result := service.Resize(id, 120, 40); !result.Success {
		t.Fatalf("resize failed: %s", result.Error)
	}

	sink.awaitOutput(t, id, "TICK6")

	if _, chunks := sink.stream(t, EventStdout, id); chunks < 2 {
		t.Fatalf("pty stdout arrived in %d chunks, want more than one", chunks)
	}

	if _, count := sink.stream(t, EventStderr, id); count != 0 {
		t.Fatalf("pty produced %d stderr events, want none", count)
	}

	if result := service.Kill(id); !result.Success {
		t.Fatalf("kill failed: %s", result.Error)
	}

	if codes := sink.exits(id); len(codes) != 1 {
		t.Fatalf("exit events = %v, want exactly one", codes)
	}
}

func TestResizeRequiresPty(t *testing.T) {
	service, sink := newRecordedService()
	defer service.CloseAll()

	id := start(t, service, childSpec("sleep"))
	sink.awaitOutput(t, id, readyMarker)

	result := service.Resize(id, 120, 40)
	if result.Success || !strings.Contains(result.Error, "pty") {
		t.Fatalf("resize without a pty = %+v, want an explanatory failure", result)
	}

	if result := service.Resize("nope", 120, 40); result.Success {
		t.Fatalf("resize of an unknown process = %+v, want a failure", result)
	}
}

func TestStartReportsFailureAsData(t *testing.T) {
	service, _ := newRecordedService()
	defer service.CloseAll()

	if result := service.Start(StartSpec{}); result.Success || result.Error == "" {
		t.Fatalf("start without a command = %+v, want a failure", result)
	}

	missing := StartSpec{Command: filepath.Join(t.TempDir(), "there-is-no-such-binary")}
	if result := service.Start(missing); result.Success || result.Error == "" {
		t.Fatalf("start of a missing binary = %+v, want a failure", result)
	}

	if listed := service.List(); len(listed.Processes) != 0 {
		t.Fatalf("failed starts left %+v in the registry", listed.Processes)
	}
}

func TestStartAppliesEnvironmentOverrides(t *testing.T) {
	t.Setenv(presentEnv, "original")
	t.Setenv(doomedEnv, "doomed")

	service, sink := newRecordedService()
	defer service.CloseAll()

	spec := childSpec("environment")
	spec.Env[presentEnv] = "replaced"
	spec.Env[doomedEnv] = ""
	spec.Env[freshEnv] = "added"

	id := start(t, service, spec)
	sink.awaitExit(t, id)

	output, _ := sink.stream(t, EventStdout, id)
	if output != "present=replaced|doomed=|fresh=added" {
		t.Fatalf("child environment = %q", output)
	}
}

func TestStartResolvesWorkingDirectory(t *testing.T) {
	service, sink := newRecordedService()
	defer service.CloseAll()

	expected, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatalf("cannot resolve the temporary directory: %v", err)
	}

	spec := childSpec("directory")
	spec.Dir = expected

	id := start(t, service, spec)
	sink.awaitExit(t, id)

	output, _ := sink.stream(t, EventStdout, id)

	reported, err := filepath.EvalSymlinks(strings.TrimSpace(output))
	if err != nil {
		t.Fatalf("cannot resolve the reported directory %q: %v", output, err)
	}

	if !strings.EqualFold(filepath.Clean(reported), filepath.Clean(expected)) {
		t.Fatalf("child ran in %q, want %q", reported, expected)
	}
}

func TestCloseAllLeavesNoGoroutines(t *testing.T) {
	service, sink := newRecordedService()

	baseline := runtime.NumGoroutine()

	ids := make([]string, 0, 3)
	for range 3 {
		id := start(t, service, childSpec("sleep"))
		sink.awaitOutput(t, id, readyMarker)
		ids = append(ids, id)
	}

	service.CloseAll()

	if listed := service.List(); len(listed.Processes) != 0 {
		t.Fatalf("list after CloseAll = %+v, want it empty", listed.Processes)
	}

	for _, id := range ids {
		if codes := sink.exits(id); len(codes) != 1 {
			t.Fatalf("exit events for %s = %v, want exactly one", id, codes)
		}
	}

	sink.await(t, func() bool { return runtime.NumGoroutine() <= baseline }, "goroutines to unwind")
}

func TestMergeEnvironment(t *testing.T) {
	base := []string{"KEEP=1", "REPLACE=old", "DROP=bye", "MALFORMED"}

	merged := mergeEnvironment(base, map[string]string{"REPLACE": "new", "DROP": "", "ADD": "yes"})

	assertEnvironment(t, merged, "KEEP", "1")
	assertEnvironment(t, merged, "REPLACE", "new")
	assertEnvironment(t, merged, "ADD", "yes")

	for _, entry := range merged {
		if strings.HasPrefix(entry, "DROP=") {
			t.Fatalf("merged environment still carries %q", entry)
		}
	}

	if !contains(merged, "MALFORMED") {
		t.Fatalf("merged environment lost the entry without an '='")
	}

	untouched := mergeEnvironment(base, nil)
	if len(untouched) != len(base) {
		t.Fatalf("merging nothing changed the environment: %v", untouched)
	}
}

func assertEnvironment(t *testing.T, environment []string, name string, value string) {
	t.Helper()

	if !contains(environment, name+"="+value) {
		t.Fatalf("environment is missing %s=%s: %v", name, value, environment)
	}
}

func contains(entries []string, wanted string) bool {
	for _, entry := range entries {
		if entry == wanted {
			return true
		}
	}
	return false
}
