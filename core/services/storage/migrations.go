package storage

// A step runs once per installation but may meet a directory an interrupted
// earlier run left half-migrated, so every Apply has to tolerate its own result.
func Migrations() []Migration {
	return []Migration{}
}
