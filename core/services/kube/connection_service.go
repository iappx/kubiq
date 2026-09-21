package kube

import "time"

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
		return ConnectResult{Error: err.Error()}
	}

	s.registry.Add(session)

	return ConnectResult{Success: true, SessionId: session.ID}
}

func (s *ConnectionService) Disconnect(id string) KubeResult {
	if _, found := s.registry.Get(id); !found {
		return KubeResult{Error: "unknown session: " + id}
	}

	s.registry.Remove(id)

	return KubeResult{Success: true}
}

func (s *ConnectionService) Sessions() SessionsResult {
	sessions := s.registry.List()

	infos := make([]SessionInfo, 0, len(sessions))
	for _, session := range sessions {
		infos = append(infos, SessionInfo{
			Id: session.ID,
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
