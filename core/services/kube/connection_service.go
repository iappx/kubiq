package kube

import (
	"time"

	"iappx_k8s_admin/core/services/journal"
)

type ConnectionService struct {
	registry *SessionRegistry
}

func NewConnectionService(registry *SessionRegistry) *ConnectionService {
	if registry == nil {
		registry = NewSessionRegistry()
	}
	return &ConnectionService{registry: registry}
}

func (s *ConnectionService) Connect(spec ConnectionSpec) ConnectResult {
	session, err := newSession(spec)
	if err != nil {
		journal.Record(journal.Entry{
			Level:     journal.LevelError,
			Component: journalComponent,
			Event:     "connection.rejected",
			Message:   err.Error(),
		})
		return ConnectResult{Error: err.Error()}
	}

	s.registry.Add(session)

	journal.Record(journal.Entry{
		Level:     journal.LevelInfo,
		Component: journalComponent,
		Event:     "connection.open",
		Session:   session.ID,
		Path:      session.BaseURL.Redacted(),
	})

	return ConnectResult{Success: true, SessionId: session.ID}
}

func (s *ConnectionService) Disconnect(id string) KubeResult {
	if _, found := s.registry.Get(id); !found {
		return KubeResult{Error: "unknown session: " + id}
	}

	s.registry.Remove(id)

	journal.Record(journal.Entry{
		Level:     journal.LevelInfo,
		Component: journalComponent,
		Event:     "connection.close",
		Session:   id,
	})

	return KubeResult{Success: true}
}

func (s *ConnectionService) Sessions() SessionsResult {
	sessions := s.registry.List()

	infos := make([]SessionInfo, 0, len(sessions))
	for _, session := range sessions {
		infos = append(infos, SessionInfo{
			Id:    session.ID,
			Label: session.Label,
			// Redacted() drops a password embedded in the server url, which
			// String() would print in full.
			Server:    session.BaseURL.Redacted(),
			CreatedAt: session.CreatedAt.UTC().Format(time.RFC3339),
		})
	}

	return SessionsResult{Success: true, Sessions: infos}
}

func (s *ConnectionService) ServiceShutdown() error {
	s.registry.Close()
	return nil
}
