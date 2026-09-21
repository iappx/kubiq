import type { SettingsEntityContext } from '@/infrastructure/entityRepo/settings/SettingsEntityContext'
import type { AppSettingsAdapter } from '@/infrastructure/settings/AppSettingsAdapter'

export type TSettingsMigrationTarget = {
    collections: SettingsEntityContext
    document: AppSettingsAdapter
}
