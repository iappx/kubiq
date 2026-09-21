package process

import (
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"iappx_k8s_admin/core/utils"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const (
	streamChunkSize = 8192
	killTimeout     = 5 * time.Second
)

type ProcessService struct {
	mu        sync.Mutex
	processes map[string]*managedProcess
	sequence  uint64
	reapers   sync.WaitGroup
	emit      func(name string, payload any)
}

func NewProcessService() *ProcessService {
	return &ProcessService{processes: make(map[string]*managedProcess)}
}

func (s *ProcessService) Start(spec StartSpec) StartResult {
	if spec.Command == "" {
		return StartResult{Error: "command is empty"}
	}

	dir := ""
	if spec.Dir != "" {
		dir = utils.GetPath(spec.Dir)
	}

	sequence := atomic.AddUint64(&s.sequence, 1)
	id := fmt.Sprintf("p%d", sequence)

	// Arguments are left out on purpose: they routinely carry credentials that
	// have no business in a log file.
	log.Printf("Process start [%s pty=%v]: %s", id, spec.Pty, spec.Command)

	managed, err := startManagedProcess(id, sequence, spec, dir, mergeEnvironment(os.Environ(), spec.Env))
	if err != nil {
		return StartResult{Error: err.Error()}
	}

	s.mu.Lock()
	s.processes[id] = managed
	s.mu.Unlock()

	for _, source := range managed.sources {
		go s.pump(managed, source)
	}

	s.reapers.Add(1)
	go s.reap(managed)

	return StartResult{Success: true, ProcessId: id}
}

func (s *ProcessService) Write(id string, data string) ProcessResult {
	managed, found := s.lookup(id)
	if !found {
		return ProcessResult{Error: "process not found: " + id}
	}

	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return ProcessResult{Error: err.Error()}
	}

	if err := managed.write(decoded); err != nil {
		return ProcessResult{Error: err.Error()}
	}

	return ProcessResult{Success: true}
}

func (s *ProcessService) Resize(id string, cols int, rows int) ProcessResult {
	managed, found := s.lookup(id)
	if !found {
		return ProcessResult{Error: "process not found: " + id}
	}

	if err := managed.resize(cols, rows); err != nil {
		return ProcessResult{Error: err.Error()}
	}

	return ProcessResult{Success: true}
}

func (s *ProcessService) Kill(id string) ProcessResult {
	managed, found := s.lookup(id)
	if !found {
		return ProcessResult{Error: "process not found: " + id}
	}

	if err := managed.group.terminate(); err != nil {
		return ProcessResult{Error: err.Error()}
	}

	select {
	case <-managed.done:
		return ProcessResult{Success: true}
	case <-time.After(killTimeout):
		return ProcessResult{Error: "process " + id + " did not exit within " + killTimeout.String()}
	}
}

func (s *ProcessService) List() ProcessListResult {
	s.mu.Lock()
	running := make([]*managedProcess, 0, len(s.processes))
	for _, managed := range s.processes {
		running = append(running, managed)
	}
	s.mu.Unlock()

	sort.Slice(running, func(i int, j int) bool { return running[i].sequence < running[j].sequence })

	processes := make([]ProcessInfo, 0, len(running))
	for _, managed := range running {
		processes = append(processes, managed.info())
	}

	return ProcessListResult{Success: true, Processes: processes}
}

func (s *ProcessService) CloseAll() {
	s.mu.Lock()
	running := make([]*managedProcess, 0, len(s.processes))
	for _, managed := range s.processes {
		running = append(running, managed)
	}
	s.mu.Unlock()

	for _, managed := range running {
		if err := managed.group.terminate(); err != nil {
			log.Printf("Process terminate [%s]: %v", managed.id, err)
		}
	}

	s.reapers.Wait()
}

func (s *ProcessService) ServiceShutdown() error {
	s.CloseAll()
	return nil
}

func (s *ProcessService) lookup(id string) (*managedProcess, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	managed, found := s.processes[id]

	return managed, found
}

func (s *ProcessService) pump(managed *managedProcess, source stream) {
	defer managed.streams.Done()

	buffer := make([]byte, streamChunkSize)

	for {
		read, err := source.source.Read(buffer)
		if read > 0 {
			s.emitEvent(source.event, StreamEvent{
				ProcessId: managed.id,
				Data:      base64.StdEncoding.EncodeToString(buffer[:read]),
			})
		}
		if err != nil {
			return
		}
	}
}

func (s *ProcessService) reap(managed *managedProcess) {
	defer s.reapers.Done()

	code := managed.wait()

	s.mu.Lock()
	delete(s.processes, managed.id)
	s.mu.Unlock()

	s.emitEvent(EventExit, ExitEvent{ProcessId: managed.id, Code: code})

	close(managed.done)
}

func (s *ProcessService) emitEvent(name string, payload any) {
	if s.emit != nil {
		s.emit(name, payload)
		return
	}

	// application.Get() is nil until application.New has run, which is the case
	// in tests and for anything emitted before startup.
	if app := application.Get(); app != nil {
		app.Event.Emit(name, payload)
	}
}
