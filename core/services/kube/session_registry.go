package kube

import (
	"slices"
	"strings"
	"sync"
)

type SessionRegistry struct {
	mutex    sync.RWMutex
	sessions map[string]*Session
}

func NewSessionRegistry() *SessionRegistry {
	return &SessionRegistry{sessions: make(map[string]*Session)}
}

func (r *SessionRegistry) Get(id string) (*Session, bool) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	session, found := r.sessions[id]
	return session, found
}

func (r *SessionRegistry) Add(session *Session) {
	if session == nil {
		return
	}

	r.mutex.Lock()
	defer r.mutex.Unlock()

	r.sessions[session.ID] = session
}

func (r *SessionRegistry) Remove(id string) {
	r.mutex.Lock()
	session, found := r.sessions[id]
	delete(r.sessions, id)
	r.mutex.Unlock()

	if found {
		session.close()
	}
}

func (r *SessionRegistry) List() []*Session {
	r.mutex.RLock()
	sessions := make([]*Session, 0, len(r.sessions))
	for _, session := range r.sessions {
		sessions = append(sessions, session)
	}
	r.mutex.RUnlock()

	slices.SortFunc(sessions, func(left *Session, right *Session) int {
		if left.CreatedAt.Equal(right.CreatedAt) {
			return strings.Compare(left.ID, right.ID)
		}
		return left.CreatedAt.Compare(right.CreatedAt)
	})

	return sessions
}

func (r *SessionRegistry) Close() {
	r.mutex.Lock()
	sessions := make([]*Session, 0, len(r.sessions))
	for _, session := range r.sessions {
		sessions = append(sessions, session)
	}
	r.sessions = make(map[string]*Session)
	r.mutex.Unlock()

	for _, session := range sessions {
		session.close()
	}
}
