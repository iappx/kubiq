import { inject } from 'tsyringe'
import { SettingsService } from '@/application/services/settings/SettingsService'
import type { TClusterSettingsDraft } from '@/domain/entities/settings/types/TClusterSettingsDraft'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { AppSettings } from '@/domain/models/settings/AppSettings'
import type { TAppSettings } from '@/domain/models/settings/types/TAppSettings'
import type { TStorageInfo } from '@/domain/models/settings/types/TStorageInfo'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class AppSettingsStore extends StoreBase<AppSettingsStore> {
    public settings: TAppSettings = AppSettings.defaults()

    public clusters: TClusterSettingsDraft[] = []

    public storage: TStorageInfo = { root: '', logs: '', version: 0 }

    public schemaVersion = 0

    public loaded = false

    public loading = false

    public saving = false

    public loadError = ''

    public loadErrorDetail = ''

    constructor(
        @inject(SettingsService) private readonly settingsService: SettingsService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public async loadOnce(): Promise<void> {
        if (this.loaded || this.loading) {
            return
        }

        await this.load()
    }

    public async load(): Promise<void> {
        this.loading = true
        try {
            const [settings, clusters, storage, schemaVersion] = await Promise.all([
                this.settingsService.read(),
                this.settingsService.listClusters(),
                this.settingsService.storageInfo(),
                this.settingsService.schemaVersion(),
            ])

            this.settings = settings
            this.clusters = clusters
            this.storage = storage
            this.schemaVersion = schemaVersion
            this.loaded = true
            this.loadError = ''
            this.loadErrorDetail = ''
        } catch (err) {
            this.loadError = err instanceof ApiError ? err.message : 'The settings could not be read'
            this.loadErrorDetail = err instanceof ApiError ? (err.details ?? '') : String(err)
            this.eventBus.emitEvent(new AppErrorEvent(err, 'AppSettingsStore.load'))
        } finally {
            this.loading = false
        }
    }

    public setKubectlPath(path: string): Promise<void> {
        return this.write({ ...this.settings, kubectlPath: path })
    }

    public setHelmPath(path: string): Promise<void> {
        return this.write({ ...this.settings, helmPath: path })
    }

    public setNodeShellImage(image: string): Promise<void> {
        return this.write({ ...this.settings, nodeShellImage: image })
    }

    public saveCluster(draft: TClusterSettingsDraft): Promise<void> {
        return this.guard('AppSettingsStore.saveCluster', async () => {
            const stored = await this.settingsService.saveClusterSettings(draft)

            this.clusters = [...this.clusters.filter(item => item.clusterId !== stored.clusterId), stored]
                .sort((left, right) => left.clusterId.localeCompare(right.clusterId))
        })
    }

    public removeCluster(clusterId: string): Promise<void> {
        return this.guard('AppSettingsStore.removeCluster', async () => {
            await this.settingsService.removeClusterSettings(clusterId)
            this.clusters = this.clusters.filter(item => item.clusterId !== clusterId)
        })
    }

    public openLogFolder(): Promise<void> {
        return this.guard('AppSettingsStore.openLogFolder', () => this.settingsService.openLogFolder())
    }

    private write(settings: TAppSettings): Promise<void> {
        return this.guard('AppSettingsStore.save', async () => {
            this.saving = true
            try {
                this.settings = await this.settingsService.save(settings)
            } finally {
                this.saving = false
            }
        })
    }

    private async guard(context: string, action: () => Promise<void>): Promise<void> {
        try {
            await action()
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, context))
        }
    }
}
