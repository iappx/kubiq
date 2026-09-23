import { inject, singleton } from 'tsyringe'
import { SettingsService } from '@/application/services/settings/SettingsService'
import { ToastService } from '@/application/services/toast/ToastService'
import { UpdateService } from '@/application/services/update/UpdateService'
import type { TUpdateSettlement } from '@/application/services/update/types/TUpdateSettlement'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { UpdateStore } from '@/store/modules/update/UpdateStore'

@singleton()
export class UpdateCheckHandler {
    public static readonly startupDelayMs: number = 10_000

    public static readonly intervalMs: number = 24 * 60 * 60 * 1000

    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(UpdateService) private readonly updateService: UpdateService,
        @inject(SettingsService) private readonly settingsService: SettingsService,
        @inject(ToastService) private readonly toastService: ToastService,
        @inject(UpdateStore) private readonly updateStore: UpdateStore,
    ) {
        void this.settle()

        setTimeout(() => void this.tick(), UpdateCheckHandler.startupDelayMs)
        setInterval(() => void this.tick(), UpdateCheckHandler.intervalMs)
    }

    private async settle(): Promise<void> {
        try {
            const settlement = await this.updateService.settle()
            if (settlement) {
                this.announce(settlement)
            }
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'UpdateCheckHandler.settle'))
        }
    }

    private async tick(): Promise<void> {
        let enabled: boolean
        try {
            enabled = (await this.settingsService.read()).checkForUpdates
        } catch {
            return
        }

        if (enabled) {
            await this.updateStore.check(true)
        }
    }

    private announce(settlement: TUpdateSettlement): void {
        if (settlement.applied) {
            this.toastService.success(`Updated to kubiq ${settlement.current}`)
            return
        }

        this.toastService.show({
            type: 'warning',
            message: `The update to kubiq ${settlement.target} did not finish`,
            description: `kubiq ${settlement.current} is still installed. Download the update again from Settings.`,
        })
    }
}
