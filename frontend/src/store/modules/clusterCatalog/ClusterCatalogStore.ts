import { inject } from 'tsyringe'
import { ClusterCatalogService } from '@/application/services/clusterCatalog/ClusterCatalogService'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import type { TClusterContextInfo } from '@/application/services/cluster/types/TClusterContextInfo'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, LoadableItemStoreBase } from '@/lib/vue-store'

@InjectableStore
export class ClusterCatalogStore extends LoadableItemStoreBase<TClusterContextInfo, ClusterCatalogStore> {
    public pinned: string[] = []

    public sources: string[] = []

    public filter = ''

    public loadError = ''

    public loadErrorDetail = ''

    constructor(
        @inject(ClusterCatalogService) private readonly catalogService: ClusterCatalogService,
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public isPinned(contextName: string): boolean {
        return this.pinned.includes(contextName)
    }

    public refresh(): Promise<void> {
        return this.runLoad(() => this.load())
    }

    public loadOnce(): Promise<void> {
        return this.runLoad(() => this.loadIfNeeded())
    }

    public setFilter(text: string): void {
        this.filter = text
    }

    public togglePin(contextName: string): Promise<void> {
        return this.guard('ClusterCatalogStore.togglePin', async () => {
            const wasPinned = this.isPinned(contextName)
            this.pinned = wasPinned
                ? this.pinned.filter(name => name !== contextName)
                : [...this.pinned, contextName]

            if (wasPinned) {
                await this.catalogService.unpin(contextName)
            } else {
                await this.catalogService.pin(contextName, Date.now())
            }
        })
    }

    public async addSource(path: string): Promise<boolean> {
        try {
            await this.catalogService.addSource(path, Date.now())
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ClusterCatalogStore.addSource'))
            return false
        }

        await this.refresh()

        return true
    }

    public removeSource(path: string): Promise<void> {
        return this.guard('ClusterCatalogStore.removeSource', async () => {
            await this.catalogService.removeSource(path)
            await this.load()
        })
    }

    protected async loadItems(): Promise<TClusterContextInfo[]> {
        const [sources, pinned] = await Promise.all([
            this.catalogService.getSources(),
            this.catalogService.getPinned(),
        ])

        this.sources = sources
        this.pinned = pinned

        return this.connectionService.listContexts(sources)
    }

    private async runLoad(action: () => Promise<void>): Promise<void> {
        try {
            await action()
            this.loadError = ''
            this.loadErrorDetail = ''
        } catch (err) {
            this.loadError = err instanceof ApiError ? err.message : 'The cluster catalog could not be read'
            this.loadErrorDetail = err instanceof ApiError ? (err.details ?? '') : String(err)
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ClusterCatalogStore.load'))
        }
    }

    private async guard(context: string, action: () => Promise<void>): Promise<void> {
        try {
            await action()
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, context))
        }
    }
}
