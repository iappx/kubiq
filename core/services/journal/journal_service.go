package journal

type JournalService struct {
	journal *Journal
}

func NewJournalService(journal *Journal) *JournalService {
	return &JournalService{journal: journal}
}

func (s *JournalService) Write(entry Entry) JournalResult {
	if s.journal == nil {
		return JournalResult{Error: "journal is unavailable"}
	}

	if err := s.journal.Write(entry); err != nil {
		return JournalResult{Error: err.Error()}
	}

	return JournalResult{Success: true}
}

func (s *JournalService) ServiceShutdown() error {
	if s.journal == nil {
		return nil
	}

	return s.journal.Close()
}
