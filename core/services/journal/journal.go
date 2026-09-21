package journal

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const (
	DefaultFileName = "kubiq.log"
	DefaultMaxBytes = 1 << 20
	DefaultMaxFiles = 5

	journalDirPerm  = 0o700
	journalFilePerm = 0o600
)

type Journal struct {
	dir      string
	name     string
	maxBytes int64
	maxFiles int

	mutex sync.Mutex
	file  *os.File
	size  int64
}

var (
	defaultMutex   sync.RWMutex
	defaultJournal *Journal
)

func Open(options Options) (*Journal, error) {
	if options.Dir == "" {
		return nil, fmt.Errorf("journal directory is required")
	}

	journal := &Journal{
		dir:      filepath.FromSlash(options.Dir),
		name:     options.FileName,
		maxBytes: options.MaxBytes,
		maxFiles: options.MaxFiles,
	}

	if journal.name == "" {
		journal.name = DefaultFileName
	}
	if journal.maxBytes <= 0 {
		journal.maxBytes = DefaultMaxBytes
	}
	if journal.maxFiles <= 0 {
		journal.maxFiles = DefaultMaxFiles
	}

	if err := journal.open(); err != nil {
		return nil, err
	}

	return journal, nil
}

func SetDefault(journal *Journal) {
	defaultMutex.Lock()
	defer defaultMutex.Unlock()

	defaultJournal = journal
}

func Default() *Journal {
	defaultMutex.RLock()
	defer defaultMutex.RUnlock()

	return defaultJournal
}

func Record(entry Entry) {
	if journal := Default(); journal != nil {
		_ = journal.Write(entry)
	}
}

func (j *Journal) Path() string {
	return filepath.ToSlash(filepath.Join(j.dir, j.name))
}

func (j *Journal) Write(entry Entry) error {
	data, err := json.Marshal(normalise(entry, time.Now()))
	if err != nil {
		return err
	}
	data = append(data, '\n')

	j.mutex.Lock()
	defer j.mutex.Unlock()

	if j.file == nil {
		if err := j.open(); err != nil {
			return err
		}
	}

	if j.size > 0 && j.size+int64(len(data)) > j.maxBytes {
		if err := j.rotate(); err != nil {
			return err
		}
	}

	written, err := j.file.Write(data)
	j.size += int64(written)

	return err
}

func (j *Journal) Close() error {
	j.mutex.Lock()
	defer j.mutex.Unlock()

	if j.file == nil {
		return nil
	}

	err := j.file.Close()
	j.file = nil

	return err
}

func (j *Journal) open() error {
	if err := os.MkdirAll(j.dir, journalDirPerm); err != nil {
		return err
	}

	file, err := os.OpenFile(filepath.Join(j.dir, j.name), os.O_APPEND|os.O_CREATE|os.O_WRONLY, journalFilePerm)
	if err != nil {
		return err
	}

	stat, err := file.Stat()
	if err != nil {
		file.Close()
		return err
	}

	j.file = file
	j.size = stat.Size()

	return nil
}

func (j *Journal) rotate() error {
	if j.file != nil {
		j.file.Close()
		j.file = nil
	}

	base := filepath.Join(j.dir, j.name)

	if j.maxFiles == 1 {
		if err := os.Remove(base); err != nil && !os.IsNotExist(err) {
			return err
		}
		return j.open()
	}

	os.Remove(archiveName(base, j.maxFiles-1))

	for index := j.maxFiles - 2; index >= 1; index-- {
		os.Rename(archiveName(base, index), archiveName(base, index+1))
	}

	if err := os.Rename(base, archiveName(base, 1)); err != nil && !os.IsNotExist(err) {
		return err
	}

	return j.open()
}

func archiveName(base string, index int) string {
	return fmt.Sprintf("%s.%d", base, index)
}
