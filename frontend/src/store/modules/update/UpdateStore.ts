import { inject } from 'tsyringe'
import { UpdateService } from '@/application/services/update/UpdateService'
import type { TDownloadedUpdate } from '@/application/services/update/types/TDownloadedUpdate'
import type { TUpdateOffer } from '@/application/services/update/types/TUpdateOffer'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { UpdateAvailableEvent } from '@/domain/events/update/UpdateAvailableEvent'
import { UpdateDownloadedEvent } from '@/domain/events/update/UpdateDownloadedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'
import type { TUpdatePhase } from '@/store/modules/update/types/TUpdatePhase'

@InjectableStore
export class UpdateStore extends StoreBase<UpdateStore> {
    public phase: TUpdatePhase = 'idle'

    public offer: TUpdateOffer | null = null

    public downloaded: TDownloadedUpdate | null = null

    public received = 0

    public total = 0

    public checkedAt = 0

    public checkError = ''

    constructor(
        @inject(UpdateService) private readonly updateService: UpdateService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public get currentVersion(): string {
        return this.updateService.currentVersion()
    }

    public get isBusy(): boolean {
        return this.phase === 'checking' || this.phase === 'downloading' || this.phase === 'installing'
    }

    public async check(automatic: boolean): Promise<void> {
        if (this.isBusy || this.phase === 'downloaded') {
            return
        }

        const previous = this.phase
        this.phase = 'checking'

        try {
            const offer = await this.updateService.latest()

            this.offer = offer
            this.checkedAt = Date.now()
            this.checkError = ''
            this.phase = offer ? 'available' : 'upToDate'

            if (offer) {
                this.eventBus.emitEvent(new UpdateAvailableEvent(offer.version, automatic))
            }
        } catch (err) {
            this.phase = previous
            this.checkError = err instanceof ApiError ? err.message : 'The update check failed'

            // Nobody asked for an automatic check, so its failure is shown in place and not raised.
            if (!automatic) {
                this.eventBus.emitEvent(new AppErrorEvent(err, 'UpdateStore.check'))
            }
        }
    }

    public async download(): Promise<void> {
        const offer = this.offer
        if (!offer || this.phase !== 'available') {
            return
        }

        this.phase = 'downloading'
        this.received = 0
        this.total = offer.asset?.size ?? 0

        try {
            const downloaded = await this.updateService.download(offer, {
                onProgress: (received, total) => {
                    this.received = received
                    this.total = total || this.total
                },
            })

            if (!downloaded) {
                this.phase = 'available'
                return
            }

            this.downloaded = downloaded
            this.phase = 'downloaded'
            this.eventBus.emitEvent(new UpdateDownloadedEvent(downloaded.version))
        } catch (err) {
            this.phase = 'available'
            this.eventBus.emitEvent(new AppErrorEvent(err, 'UpdateStore.download'))
        }
    }

    public async cancelDownload(): Promise<void> {
        if (this.phase !== 'downloading') {
            return
        }

        await this.guard('UpdateStore.cancelDownload', () => this.updateService.cancelDownload())
    }

    public async install(): Promise<void> {
        const downloaded = this.downloaded
        if (!downloaded || this.phase !== 'downloaded') {
            return
        }

        this.phase = 'installing'

        try {
            await this.updateService.install(downloaded)
        } catch (err) {
            this.phase = 'downloaded'
            this.eventBus.emitEvent(new AppErrorEvent(err, 'UpdateStore.install'))
        }
    }

    public openReleasePage(): Promise<void> {
        const offer = this.offer
        if (!offer) {
            return Promise.resolve()
        }

        return this.guard('UpdateStore.openReleasePage', () => this.updateService.openReleasePage(offer))
    }

    private async guard(context: string, action: () => Promise<void>): Promise<void> {
        try {
            await action()
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, context))
        }
    }
}
