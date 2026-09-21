import type { TSettingsMigrationTarget } from '@/application/services/settings/types/TSettingsMigrationTarget'

export type TSettingsMigration = {
    to: number
    apply: (target: TSettingsMigrationTarget) => Promise<void>
}
