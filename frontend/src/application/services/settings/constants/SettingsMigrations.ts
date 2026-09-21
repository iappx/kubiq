import type { TSettingsMigration } from '@/application/services/settings/types/TSettingsMigration'

export class SettingsMigrations {
    public static readonly CurrentVersion = 1

    // A lost or unreadable version stamp replays the history from zero, so every step
    // here has to be idempotent — the same rule the Go side records in migrations.go.
    public static all(): TSettingsMigration[] {
        return []
    }
}
