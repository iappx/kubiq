package storage

type StorageService struct {
	storage *Storage
}

func NewStorageService(storage *Storage) *StorageService {
	return &StorageService{storage: storage}
}

func (s *StorageService) Info() StorageInfo {
	if s.storage == nil {
		return StorageInfo{Error: "user data directory is unavailable"}
	}

	return StorageInfo{
		Success: true,
		Root:    s.storage.Root(),
		Logs:    s.storage.LogsDir(),
		Version: s.storage.Version(),
	}
}
