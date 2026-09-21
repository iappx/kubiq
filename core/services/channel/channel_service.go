package channel

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"iappx_k8s_admin/core/services/kube"
)

const (
	maxConcurrentChannels = 32
	maxConcurrentForwards = 32
	maxPortNumber         = 65535
	stopWaitTimeout       = 5 * time.Second
)

type ChannelService struct {
	registry *kube.SessionRegistry
	emitter  eventEmitter

	mutex    sync.Mutex
	channels map[string]*channelHandle
	forwards map[string]*forwardHandle
	// A handle is published only once its socket is live, so the slot it will
	// take is counted here while it opens.
	openingChannels int
	openingForwards int
}

func NewChannelService(registry *kube.SessionRegistry) *ChannelService {
	if registry == nil {
		registry = kube.NewSessionRegistry()
	}

	return &ChannelService{
		registry: registry,
		emitter:  wailsEmitter{},
		channels: make(map[string]*channelHandle),
		forwards: make(map[string]*forwardHandle),
	}
}

func (s *ChannelService) ServiceShutdown() error {
	s.closeAllChannels()
	s.stopAllForwards()

	return nil
}

func (s *ChannelService) reserveChannel() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if len(s.channels)+s.openingChannels >= maxConcurrentChannels {
		return fmt.Errorf("channel limit reached: %d channels are already open", maxConcurrentChannels)
	}

	s.openingChannels++

	return nil
}

func (s *ChannelService) addChannel(handle *channelHandle) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.openingChannels--
	s.channels[handle.id] = handle
}

func (s *ChannelService) abandonChannel() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.openingChannels--
}

func (s *ChannelService) removeChannel(id string) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	delete(s.channels, id)
}

func (s *ChannelService) channel(id string) (*channelHandle, bool) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	handle, found := s.channels[id]

	return handle, found
}

func (s *ChannelService) listChannels() []*channelHandle {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	handles := make([]*channelHandle, 0, len(s.channels))
	for _, handle := range s.channels {
		handles = append(handles, handle)
	}

	return handles
}

func (s *ChannelService) reserveForward() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if len(s.forwards)+s.openingForwards >= maxConcurrentForwards {
		return fmt.Errorf("forward limit reached: %d forwards are already running", maxConcurrentForwards)
	}

	s.openingForwards++

	return nil
}

func (s *ChannelService) addForward(handle *forwardHandle) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.openingForwards--
	s.forwards[handle.id] = handle
}

func (s *ChannelService) abandonForward() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.openingForwards--
}

func (s *ChannelService) removeForward(id string) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	delete(s.forwards, id)
}

func (s *ChannelService) forward(id string) (*forwardHandle, bool) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	handle, found := s.forwards[id]

	return handle, found
}

func (s *ChannelService) listForwards() []*forwardHandle {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	handles := make([]*forwardHandle, 0, len(s.forwards))
	for _, handle := range s.forwards {
		handles = append(handles, handle)
	}

	return handles
}

func newID() string {
	buffer := make([]byte, 16)
	_, _ = rand.Read(buffer)

	return hex.EncodeToString(buffer)
}

func awaitDone(done <-chan struct{}) {
	// Cancelling unblocks the reader, but a bound method must return even if a
	// connection fails to honour that.
	timer := time.NewTimer(stopWaitTimeout)
	defer timer.Stop()

	select {
	case <-done:
	case <-timer.C:
	}
}
