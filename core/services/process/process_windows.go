//go:build windows

package process

import (
	"os"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

const environmentCaseInsensitive = true

type processGroup struct {
	job windows.Handle
}

func newProcessGroup() (*processGroup, error) {
	job, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return nil, err
	}

	// KILL_ON_JOB_CLOSE makes the last handle closing a second kill switch, so a
	// crash of this process cannot leave the tree behind.
	limits := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{
		BasicLimitInformation: windows.JOBOBJECT_BASIC_LIMIT_INFORMATION{
			LimitFlags: windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
		},
	}

	_, err = windows.SetInformationJobObject(
		job,
		windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&limits)),
		uint32(unsafe.Sizeof(limits)),
	)
	if err != nil {
		windows.CloseHandle(job)
		return nil, err
	}

	return &processGroup{job: job}, nil
}

func (g *processGroup) procAttr(bool) *syscall.SysProcAttr {
	return nil
}

func (g *processGroup) attach(process *os.Process) error {
	handle, err := windows.OpenProcess(windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, uint32(process.Pid))
	if err != nil {
		return err
	}
	defer windows.CloseHandle(handle)

	return windows.AssignProcessToJobObject(g.job, handle)
}

func (g *processGroup) terminate() error {
	return windows.TerminateJobObject(g.job, 1)
}

func (g *processGroup) close() {
	windows.CloseHandle(g.job)
}

func detachedProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{CreationFlags: windows.CREATE_NEW_PROCESS_GROUP | windows.DETACHED_PROCESS}
}
