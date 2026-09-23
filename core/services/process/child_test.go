package process

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"testing"
	"time"
)

const (
	childModeEnv      = "PROCESS_SERVICE_CHILD_MODE"
	childExitCodeEnv  = "PROCESS_SERVICE_CHILD_EXIT_CODE"
	childHeartbeatEnv = "PROCESS_SERVICE_CHILD_HEARTBEAT"
	childTicksEnv     = "PROCESS_SERVICE_CHILD_TICKS"

	presentEnv = "PROCESS_SERVICE_PRESENT"
	doomedEnv  = "PROCESS_SERVICE_DOOMED"
	freshEnv   = "PROCESS_SERVICE_FRESH"
)

const (
	readyMarker    = "READY"
	greetingMarker = "GREETING"
	stderrMarker   = "PROBLEM"

	bulkBlocks    = 40
	bulkBlockUnit = "aé→\U0001F600"
	bulkBlockSize = 800
)

func TestMain(m *testing.M) {
	switch os.Getenv(childModeEnv) {
	case "":
		os.Exit(m.Run())
	case "bulk":
		runBulkChild()
	case "echo":
		runEchoChild()
	case "exit":
		runExitChild()
	case "sleep":
		runSleepChild()
	case "ticks":
		runTicksChild()
	case "tree":
		runTreeChild()
	case "heartbeat":
		runHeartbeatChild()
	case "environment":
		runEnvironmentChild()
	case "directory":
		runDirectoryChild()
	case "marker":
		runMarkerChild()
	default:
		fmt.Fprintf(os.Stderr, "unknown child mode %q\n", os.Getenv(childModeEnv))
		os.Exit(2)
	}

	os.Exit(0)
}

func bulkPayload() string {
	var builder strings.Builder
	for block := 0; block < bulkBlocks; block++ {
		builder.WriteString(strings.Repeat(bulkBlockUnit, bulkBlockSize))
	}
	return builder.String()
}

func runBulkChild() {
	block := strings.Repeat(bulkBlockUnit, bulkBlockSize)
	for written := 0; written < bulkBlocks; written++ {
		fmt.Fprint(os.Stdout, block)
	}
}

func runEchoChild() {
	fmt.Fprint(os.Stdout, greetingMarker)
	fmt.Fprint(os.Stderr, stderrMarker)

	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "quit" {
			break
		}
		fmt.Fprintf(os.Stdout, "echo:%s\n", line)
	}
}

func runExitChild() {
	code, err := strconv.Atoi(os.Getenv(childExitCodeEnv))
	if err != nil {
		code = 0
	}
	fmt.Fprint(os.Stdout, readyMarker)
	os.Exit(code)
}

func runSleepChild() {
	fmt.Fprint(os.Stdout, readyMarker)
	time.Sleep(10 * time.Minute)
}

func runTicksChild() {
	ticks, err := strconv.Atoi(os.Getenv(childTicksEnv))
	if err != nil {
		ticks = 10
	}
	for tick := 0; tick < ticks; tick++ {
		fmt.Fprintf(os.Stdout, "TICK%d\n", tick)
		time.Sleep(50 * time.Millisecond)
	}
}

func runTreeChild() {
	grandchild := exec.Command(os.Args[0])
	grandchild.Env = append(os.Environ(), childModeEnv+"=heartbeat")
	if err := grandchild.Start(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	fmt.Fprint(os.Stdout, readyMarker)
	time.Sleep(10 * time.Minute)
}

func runHeartbeatChild() {
	path := os.Getenv(childHeartbeatEnv)
	for {
		file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			os.Exit(2)
		}
		file.Write([]byte{'.'})
		file.Close()
		time.Sleep(25 * time.Millisecond)
	}
}

func runEnvironmentChild() {
	fmt.Fprintf(os.Stdout, "present=%s|doomed=%s|fresh=%s",
		os.Getenv(presentEnv), os.Getenv(doomedEnv), os.Getenv(freshEnv))
}

func runDirectoryChild() {
	directory, err := os.Getwd()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	fmt.Fprint(os.Stdout, directory)
}

func runMarkerChild() {
	directory, err := os.Getwd()
	if err != nil {
		os.Exit(2)
	}
	if err := os.WriteFile(os.Args[len(os.Args)-1], []byte(directory), 0o600); err != nil {
		os.Exit(2)
	}
}
