import { inject } from 'tsyringe'
import { ClusterDiscoveryService } from '@/application/services/clusterDiscovery/ClusterDiscoveryService'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeResourceKind } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class ClusterDiscoveryStore extends StoreBase<ClusterDiscoveryStore> {
    public kinds: Record<string, KubeResourceKind[]> = {}

    public loadingIds: string[] = []

    public failures: Record<string, string> = {}

    constructor(
        @inject(ClusterDiscoveryService) private readonly discoveryService: ClusterDiscoveryService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public kindsOf(clusterId: string): KubeResourceKind[] {
        return this.kinds[clusterId] ?? []
    }

    public isLoading(clusterId: string): boolean {
        return this.loadingIds.includes(clusterId)
    }

    public isDiscovered(clusterId: string): boolean {
        return clusterId in this.kinds
    }

    public failureOf(clusterId: string): string {
        return this.failures[clusterId] ?? ''
    }

    public findBySlug(clusterId: string, slug: string): KubeResourceKind | undefined {
        return this.kindsOf(clusterId).find(kind => kind.slug === slug)
    }

    public loadOnce(clusterId: string): Promise<void> {
        if (!clusterId || this.isLoading(clusterId) || this.isDiscovered(clusterId)) {
            return Promise.resolve()
        }

        return this.reload(clusterId)
    }

    public async reload(clusterId: string): Promise<void> {
        if (!clusterId || this.isLoading(clusterId)) {
            return
        }

        this.loadingIds = [...this.loadingIds, clusterId]
        try {
            this.kinds = { ...this.kinds, [clusterId]: await this.discoveryService.listKinds(clusterId) }
            this.clearFailure(clusterId)
        } catch (err) {
            this.failures = {
                ...this.failures,
                [clusterId]: err instanceof ApiError ? err.message : 'The cluster did not answer discovery',
            }
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ClusterDiscoveryStore.reload'))
        } finally {
            this.loadingIds = this.loadingIds.filter(id => id !== clusterId)
        }
    }

    public forget(clusterId: string): void {
        if (clusterId in this.kinds) {
            const remaining = { ...this.kinds }
            delete remaining[clusterId]
            this.kinds = remaining
        }

        this.clearFailure(clusterId)
    }

    private clearFailure(clusterId: string): void {
        if (!(clusterId in this.failures)) {
            return
        }

        const remaining = { ...this.failures }
        delete remaining[clusterId]
        this.failures = remaining
    }
}
