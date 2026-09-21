package storage

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"

	"iappx_k8s_admin/core/utils"
)

const (
	CurrentVersion = 1

	stateFileName = "state.json"

	storageDirPerm  = 0o700
	storageFilePerm = 0o600
)

type Storage struct {
	root string
	logs string
}

func Open() (*Storage, error) {
	root, err := utils.UserDataDir()
	if err != nil {
		return nil, err
	}

	return OpenAt(root)
}

func OpenAt(root string) (*Storage, error) {
	logs := filepath.Join(filepath.FromSlash(root), utils.LogsDirName)
	if err := os.MkdirAll(logs, storageDirPerm); err != nil {
		return nil, err
	}

	return &Storage{
		root: filepath.ToSlash(root),
		logs: filepath.ToSlash(logs),
	}, nil
}

func (s *Storage) Root() string {
	return s.root
}

func (s *Storage) LogsDir() string {
	return s.logs
}

func (s *Storage) Version() int {
	return s.readState().Version
}

func (s *Storage) Migrate() error {
	return s.apply(Migrations())
}

func (s *Storage) apply(steps []Migration) error {
	version := s.readState().Version

	ordered := append([]Migration(nil), steps...)
	sort.Slice(ordered, func(first int, second int) bool {
		return ordered[first].To < ordered[second].To
	})

	for _, step := range ordered {
		if step.To <= version || step.Apply == nil {
			continue
		}

		if err := step.Apply(s.root); err != nil {
			return err
		}

		version = step.To
		if err := s.writeState(State{Version: version}); err != nil {
			return err
		}
	}

	if version < CurrentVersion {
		return s.writeState(State{Version: CurrentVersion})
	}

	return nil
}

func (s *Storage) readState() State {
	data, err := os.ReadFile(s.statePath())
	if err != nil {
		return State{}
	}

	var state State
	if err := json.Unmarshal(data, &state); err != nil || state.Version < 0 {
		return State{}
	}

	return state
}

func (s *Storage) writeState(state State) error {
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}

	temporary := s.statePath() + ".tmp"
	if err := os.WriteFile(temporary, data, storageFilePerm); err != nil {
		return err
	}

	return os.Rename(temporary, s.statePath())
}

func (s *Storage) statePath() string {
	return filepath.Join(filepath.FromSlash(s.root), stateFileName)
}
