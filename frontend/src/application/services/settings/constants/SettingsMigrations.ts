import type { TSettingsMigration } from '@/application/services/settings/types/TSettingsMigration'
import type { TSettingsMigrationTarget } from '@/application/services/settings/types/TSettingsMigrationTarget'
import { PrometheusLayoutCatalog } from '@/domain/models/metrics'

export class SettingsMigrations {
    public static readonly CurrentVersion = 2

    // A lost or unreadable version stamp replays the history from zero, so every step
    // here has to be idempotent — the same rule the Go side records in migrations.go.
    public static all(): TSettingsMigration[] {
        return [
            { to: 2, apply: target => SettingsMigrations.addPrometheusLayout(target) },
        ]
    }

    private static async addPrometheusLayout(target: TSettingsMigrationTarget): Promise<void> {
        const stored = await target.collections.clusters.getAll()

        for (const entity of stored) {
            if (PrometheusLayoutCatalog.has(entity.prometheusLayout)) {
                continue
            }

            entity.prometheusLayout = PrometheusLayoutCatalog.Default
            await target.collections.clusters.update(entity)
        }
    }
}
