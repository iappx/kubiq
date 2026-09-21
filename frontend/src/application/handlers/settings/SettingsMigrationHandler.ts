import { inject, singleton } from 'tsyringe'
import { SettingsService } from '@/application/services/settings/SettingsService'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppSettingsStore } from '@/store/modules/settings/AppSettingsStore'

@singleton()
export class SettingsMigrationHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(SettingsService) private readonly settingsService: SettingsService,
        @inject(AppSettingsStore) private readonly settingsStore: AppSettingsStore,
    ) {
        void this.run()
    }

    private async run(): Promise<void> {
        try {
            await this.settingsService.migrate()
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'SettingsMigrationHandler.migrate'))
            return
        }

        await this.settingsStore.loadOnce()
    }
}
