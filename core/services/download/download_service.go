package download

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"iappx_k8s_admin/core/utils"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const (
	progressInterval      = 100 * time.Millisecond
	responseHeaderTimeout = 30 * time.Second
	partialSuffix         = ".part"
	copyBufferSize        = 64 * 1024
)

type DownloadService struct {
	mu       sync.Mutex
	active   map[string]context.CancelFunc
	sequence uint64
	workers  sync.WaitGroup
	client   *http.Client
	emit     func(name string, payload any)
}

func NewDownloadService() *DownloadService {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.ResponseHeaderTimeout = responseHeaderTimeout

	return &DownloadService{
		active: make(map[string]context.CancelFunc),
		client: &http.Client{Transport: transport},
	}
}

func (s *DownloadService) Start(spec DownloadSpec) StartResult {
	if spec.Url == "" {
		return StartResult{Error: "url is empty"}
	}
	if spec.Path == "" {
		return StartResult{Error: "path is empty"}
	}

	target, err := utils.ResolvePath(spec.Path)
	if err != nil {
		return StartResult{Error: err.Error()}
	}

	id := fmt.Sprintf("d%d", atomic.AddUint64(&s.sequence, 1))
	ctx, cancel := context.WithCancel(context.Background())

	s.mu.Lock()
	s.active[id] = cancel
	s.mu.Unlock()

	log.Printf("Download start [%s]: %s", id, spec.Url)

	s.workers.Add(1)
	go s.run(ctx, id, spec, target)

	return StartResult{Success: true, DownloadId: id}
}

func (s *DownloadService) Cancel(id string) DownloadResult {
	s.mu.Lock()
	cancel, found := s.active[id]
	s.mu.Unlock()

	if !found {
		return DownloadResult{Error: "download not found: " + id}
	}

	cancel()

	return DownloadResult{Success: true}
}

func (s *DownloadService) ServiceShutdown() error {
	s.mu.Lock()
	for _, cancel := range s.active {
		cancel()
	}
	s.mu.Unlock()

	s.workers.Wait()

	return nil
}

func (s *DownloadService) run(ctx context.Context, id string, spec DownloadSpec, target string) {
	defer s.workers.Done()

	size, digest, err := s.fetch(ctx, id, spec, target)

	s.mu.Lock()
	cancel := s.active[id]
	delete(s.active, id)
	s.mu.Unlock()
	cancel()

	done := DoneEvent{DownloadId: id, Path: target}
	switch {
	case err == nil:
		done.Success = true
		done.Size = size
		done.Sha256 = digest
	case errors.Is(err, context.Canceled):
		done.Cancelled = true
		done.Error = "download cancelled"
	default:
		done.Error = err.Error()
	}

	log.Printf("Download finished [%s]: success=%v cancelled=%v", id, done.Success, done.Cancelled)
	s.emitEvent(EventDone, done)
}

func (s *DownloadService) fetch(ctx context.Context, id string, spec DownloadSpec, target string) (int64, string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, spec.Url, nil)
	if err != nil {
		return 0, "", err
	}
	for name, value := range spec.Headers {
		request.Header.Set(name, value)
	}

	response, err := s.client.Do(request)
	if err != nil {
		return 0, "", err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode > 299 {
		return 0, "", fmt.Errorf("server answered %s", response.Status)
	}

	if err := os.MkdirAll(filepath.Dir(target), os.ModePerm); err != nil {
		return 0, "", err
	}

	partial := target + partialSuffix
	file, err := os.Create(partial)
	if err != nil {
		return 0, "", err
	}

	hash := sha256.New()
	progress := &progressWriter{
		id:    id,
		total: max(response.ContentLength, 0),
		emit:  s.emitEvent,
	}

	_, copyErr := io.CopyBuffer(io.MultiWriter(file, hash, progress), response.Body, make([]byte, copyBufferSize))
	closeErr := file.Close()

	if copyErr == nil {
		copyErr = closeErr
	}
	if copyErr == nil && ctx.Err() != nil {
		copyErr = ctx.Err()
	}
	if copyErr != nil {
		os.Remove(partial)
		return 0, "", copyErr
	}

	progress.flush()

	if err := os.Rename(partial, target); err != nil {
		os.Remove(partial)
		return 0, "", err
	}

	return progress.received, hex.EncodeToString(hash.Sum(nil)), nil
}

func (s *DownloadService) emitEvent(name string, payload any) {
	if s.emit != nil {
		s.emit(name, payload)
		return
	}

	if app := application.Get(); app != nil {
		app.Event.Emit(name, payload)
	}
}

type progressWriter struct {
	id       string
	received int64
	total    int64
	sentAt   time.Time
	emit     func(name string, payload any)
}

func (w *progressWriter) Write(chunk []byte) (int, error) {
	w.received += int64(len(chunk))

	if time.Since(w.sentAt) >= progressInterval {
		w.flush()
	}

	return len(chunk), nil
}

func (w *progressWriter) flush() {
	w.sentAt = time.Now()
	w.emit(EventProgress, ProgressEvent{DownloadId: w.id, Received: w.received, Total: w.total})
}
