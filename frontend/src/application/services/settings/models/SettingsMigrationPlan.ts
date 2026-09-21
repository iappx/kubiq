import type { TSettingsMigration } from '@/application/services/settings/types/TSettingsMigration'

export class SettingsMigrationPlan {
    public static pending(from: number, steps: TSettingsMigration[]): TSettingsMigration[] {
        return steps
            .filter(step => step.to > from)
            .sort((left, right) => left.to - right.to)
    }

    public static targetVersion(from: number, steps: TSettingsMigration[], current: number): number {
        const pending = SettingsMigrationPlan.pending(from, steps)
        const last = pending.length > 0 ? pending[pending.length - 1].to : from

        return Math.max(last, current)
    }
}
