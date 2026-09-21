//go:build !windows

package process

import (
	"errors"
	"os"
	"syscall"
)

const environmentCaseInsensitive = false

type processGroup struct {
	leader int
}

func newProcessGroup() (*processGroup, error) {
	return &processGroup{}, nil
}

// A pty start already calls setsid, and setpgid on a session leader fails, so
// the group is only requested for the plain case.
func (g *processGroup) procAttr(inTerminal bool) *syscall.SysProcAttr {
	if inTerminal {
		return nil
	}
	return &syscall.SysProcAttr{Setpgid: true}
}

func (g *processGroup) attach(process *os.Process) error {
	g.leader = process.Pid
	return nil
}

func (g *processGroup) terminate() error {
	if g.leader == 0 {
		return errors.New("process group has no leader")
	}
	return syscall.Kill(-g.leader, syscall.SIGKILL)
}

// Windows frees the job object here, which kills whatever is still in it; the
// group is swept the same way so a leftover grandchild is never orphaned.
func (g *processGroup) close() {
	if g.leader == 0 {
		return
	}
	syscall.Kill(-g.leader, syscall.SIGKILL)
}
