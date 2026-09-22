import { inject } from 'tsyringe'
import { ClusterCatalogService } from '@/application/services/clusterCatalog/ClusterCatalogService'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import type { TClusterContextInfo } from '@/application/services/cluster/types/TClusterContextInfo'
import type { TClusterSourceOrigin } from '@/domain/entities/catalog/types/TClusterSourceOrigin'
import type { TKubeconfigSourceMode } from '@/domain/entities/catalog/types/TKubeconfigSourceMode'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ClusterRemovedEvent } from '@/domain/events/cluster/ClusterRemovedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, LoadableItemStoreBase } from '@/lib/vue-store'
import type { TKubeconfigDeletion } from '@/store/modules/clusterCatalog/types/TKubeconfigDeletion'

@InjectableStore
export class ClusterCatalogStore extends LoadableItemStoreBase<TClusterContextInfo, ClusterCatalogStore> {
    public pinned: string[] = []

    public sources: string[] = []

    public sourceOrigins: Record<string, TKubeconfigSourceMode> = {}

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

    public originOf(filePath: string): TClusterSourceOrigin {
        return this.sourceOrigins[filePath] ?? 'discovered'
    }

    public deletionOf(filePath: string): TKubeconfigDeletion {
        return {
            filePath,
            origin: this.originOf(filePath),
            clusterNames: this.clustersOf(filePath),
        }
    }

    public clustersOf(filePath: string): string[] {
        return this.items
            .filter(context => context.filePath === filePath)
            .map(context => context.name)
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

    public async addSource(path: string, origin: TKubeconfigSourceMode): Promise<boolean> {
        try {
            await this.catalogService.addSource(path, origin, Date.now())
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ClusterCatalogStore.addSource'))
            return false
        }

        await this.refresh()

        return true
    }

    public removeSource(path: string): Promise<void> {
        return this.guard('ClusterCatalogStore.removeSource', async () => {
            const contextNames = this.clustersOf(path)
            const deleted = await this.catalogService.removeSource(path, contextNames)

            await this.load()
            this.eventBus.emitEvent(new ClusterRemovedEvent(path, contextNames, deleted))
        })
    }

    protected async loadItems(): Promise<TClusterContextInfo[]> {
        const [sources, pinned] = await Promise.all([
            this.catalogService.getSources(),
            this.catalogService.getPinned(),
        ])

        this.sources = sources.map(source => source.path)
        this.sourceOrigins = Object.fromEntries(sources.map(source => [source.path, source.origin]))
        this.pinned = pinned

        return this.connectionService.listContexts(this.sources)
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
