import { inject, singleton } from 'tsyringe'
import { ToastService } from '@/application/services/toast/ToastService'
import { UpdateAvailableEvent } from '@/domain/events/update/UpdateAvailableEvent'
import { UpdateDownloadedEvent } from '@/domain/events/update/UpdateDownloadedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppSettingsStore } from '@/store/modules/settings/AppSettingsStore'

@singleton()
export class UpdateNotificationHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ToastService) private readonly toastService: ToastService,
        @inject(AppSettingsStore) private readonly settingsStore: AppSettingsStore,
    ) {
        this.eventBus.registerHandler(UpdateAvailableEvent, e => this.announceAvailable(e))
        this.eventBus.registerHandler(UpdateDownloadedEvent, e => this.announceDownloaded(e))
    }

    // A manual check answers on the settings page itself; only a background one needs a toast.
    private announceAvailable(event: UpdateAvailableEvent): void {
        if (!event.automatic || event.version === this.settingsStore.settings.skippedVersion) {
            return
        }

        this.toastService.show({
            type: 'info',
            message: `kubiq ${event.version} is available`,
            description: 'Download it from Settings when you are ready.',
        })
    }

    private announceDownloaded(event: UpdateDownloadedEvent): void {
        this.toastService.success(`kubiq ${event.version} is downloaded`, 'Checksum verified. Install it from Settings.')
    }
}
