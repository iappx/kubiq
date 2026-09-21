import { inject } from 'tsyringe'
import { ClusterNamespaceService } from '@/application/services/clusterNamespace/ClusterNamespaceService'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class ClusterNamespaceStore extends StoreBase<ClusterNamespaceStore> {
    public available: Record<string, string[]> = {}

    public loadingIds: string[] = []

    constructor(
        @inject(ClusterNamespaceService) private readonly namespaceService: ClusterNamespaceService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public availableOf(clusterId: string): string[] {
        return this.available[clusterId] ?? []
    }

    public isLoading(clusterId: string): boolean {
        return this.loadingIds.includes(clusterId)
    }

    public async loadFor(clusterId: string): Promise<void> {
        if (!clusterId || this.isLoading(clusterId) || clusterId in this.available) {
            return
        }

        this.loadingIds = [...this.loadingIds, clusterId]
        try {
            this.available = {
                ...this.available,
                [clusterId]: await this.namespaceService.listAvailable(clusterId),
            }
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ClusterNamespaceStore.loadFor'))
        } finally {
            this.loadingIds = this.loadingIds.filter(id => id !== clusterId)
        }
    }

    public forget(clusterId: string): void {
        if (!(clusterId in this.available)) {
            return
        }

        const remaining = { ...this.available }
        delete remaining[clusterId]
        this.available = remaining
    }
}
