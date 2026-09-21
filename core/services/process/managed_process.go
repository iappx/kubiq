package process

import (
	"errors"
	"io"
	"os"
	"os/exec"
	"sync"
	"sync/atomic"
	"time"

	"github.com/aymanbagabas/go-pty"
)

// ClosePseudoConsole drops whatever the output pipe still holds, so the reader
// is given a moment to drain the tail before the console is torn down.
const terminalDrainGrace = 50 * time.Millisecond

type managedProcess struct {
	id        string
	sequence  uint64
	command   string
	startedAt time.Time

	group       *processGroup
	terminal    pty.Pty
	terminalCmd *pty.Cmd
	cmd         *exec.Cmd

	sources    []stream
	sourceEnds []io.Closer

	input   io.Writer
	closer  io.Closer
	inputMu sync.Mutex
	running atomic.Bool

	streams sync.WaitGroup
	done    chan struct{}
}

type stream struct {
	event  string
	source io.Reader
}

func startManagedProcess(id string, sequence uint64, spec StartSpec, dir string, env []string) (*managedProcess, error) {
	group, err := newProcessGroup()
	if err != nil {
		return nil, err
	}

	managed := &managedProcess{
		id:        id,
		sequence:  sequence,
		command:   spec.Command,
		startedAt: time.Now(),
		group:     group,
		done:      make(chan struct{}),
	}

	if spec.Pty {
		err = managed.startInTerminal(spec, dir, env)
	} else {
		err = managed.startPlain(spec, dir, env)
	}
	if err != nil {
		group.close()
		return nil, err
	}

	managed.running.Store(true)
	managed.streams.Add(len(managed.sources))

	return managed, nil
}

func (m *managedProcess) startPlain(spec StartSpec, dir string, env []string) error {
	// os.Pipe ends rather than cmd.StdoutPipe: an *os.File is handed to the child
	// directly, so Wait reports the exit instead of awaiting inherited handles.
	stdoutRead, stdoutWrite, err := os.Pipe()
	if err != nil {
		return err
	}

	stderrRead, stderrWrite, err := os.Pipe()
	if err != nil {
		stdoutRead.Close()
		stdoutWrite.Close()
		return err
	}

	stdinRead, stdinWrite, err := os.Pipe()
	if err != nil {
		stdoutRead.Close()
		stdoutWrite.Close()
		stderrRead.Close()
		stderrWrite.Close()
		return err
	}

	cmd := exec.Command(spec.Command, spec.Args...)
	cmd.Dir = dir
	cmd.Env = env
	cmd.SysProcAttr = m.group.procAttr(false)
	cmd.Stdout = stdoutWrite
	cmd.Stderr = stderrWrite
	cmd.Stdin = stdinRead

	startErr := cmd.Start()

	stdoutWrite.Close()
	stderrWrite.Close()
	stdinRead.Close()

	if startErr != nil {
		stdoutRead.Close()
		stderrRead.Close()
		stdinWrite.Close()
		return startErr
	}

	m.cmd = cmd
	m.input = stdinWrite
	m.closer = stdinWrite
	m.sources = []stream{{EventStdout, stdoutRead}, {EventStderr, stderrRead}}
	m.sourceEnds = []io.Closer{stdoutRead, stderrRead}

	return m.group.attach(cmd.Process)
}

func (m *managedProcess) startInTerminal(spec StartSpec, dir string, env []string) error {
	terminal, err := pty.New()
	if err != nil {
		return err
	}

	if spec.Cols > 0 && spec.Rows > 0 {
		if err := terminal.Resize(spec.Cols, spec.Rows); err != nil {
			terminal.Close()
			return err
		}
	}

	cmd := terminal.Command(spec.Command, spec.Args...)
	cmd.Dir = dir
	cmd.Env = env
	cmd.SysProcAttr = m.group.procAttr(true)

	if err := cmd.Start(); err != nil {
		terminal.Close()
		return err
	}

	m.terminal = terminal
	m.terminalCmd = cmd
	m.input = terminal
	m.closer = terminal
	m.sources = []stream{{EventStdout, terminal}}

	return m.group.attach(cmd.Process)
}

func (m *managedProcess) wait() int {
	if m.terminal != nil {
		err := m.terminalCmd.Wait()
		time.Sleep(terminalDrainGrace)
		m.closeInput()
		m.streams.Wait()
		m.group.close()

		return exitCode(m.terminalCmd.ProcessState, err)
	}

	err := m.cmd.Wait()
	m.closeInput()
	// Anything the root left behind still holds the write ends of the pipes, so
	// the group is emptied before the readers are awaited.
	m.group.close()
	m.streams.Wait()

	for _, end := range m.sourceEnds {
		end.Close()
	}

	return exitCode(m.cmd.ProcessState, err)
}

func (m *managedProcess) write(data []byte) error {
	m.inputMu.Lock()
	defer m.inputMu.Unlock()

	if !m.running.Load() {
		return errors.New("process is not running")
	}

	_, err := m.input.Write(data)

	return err
}

func (m *managedProcess) resize(cols int, rows int) error {
	if m.terminal == nil {
		return errors.New("resize is only supported for a process started with pty")
	}
	if cols <= 0 || rows <= 0 {
		return errors.New("cols and rows must be positive")
	}

	return m.terminal.Resize(cols, rows)
}

func (m *managedProcess) info() ProcessInfo {
	return ProcessInfo{
		Id:        m.id,
		Command:   m.command,
		Pty:       m.terminal != nil,
		StartedAt: m.startedAt.Format(time.RFC3339Nano),
		Running:   m.running.Load(),
	}
}

func (m *managedProcess) closeInput() {
	m.inputMu.Lock()
	defer m.inputMu.Unlock()

	m.running.Store(false)
	m.closer.Close()
}

func exitCode(state *os.ProcessState, err error) int {
	if state != nil {
		return state.ExitCode()
	}

	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) && exitErr.ProcessState != nil {
		return exitErr.ProcessState.ExitCode()
	}

	return -1
}
