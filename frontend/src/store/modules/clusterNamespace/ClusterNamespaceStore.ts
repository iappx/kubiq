import { inject } from 'tsyringe'
import { ClusterNamespaceService } from '@/application/services/clusterNamespace/ClusterNamespaceService'
import type { TNamespaceCatalog } from '@/application/services/clusterNamespace/types/TNamespaceCatalog'
import type { TResourceChange } from '@/application/services/resourceWatch/types/TResourceChange'
import { NamespaceEntity } from '@/domain/entities/cluster/NamespaceEntity'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import type { TKubeFailureKind } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'
import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class ClusterNamespaceStore extends StoreBase<ClusterNamespaceStore> {
    public available: Record<string, string[]> = {}

    public failures: Record<string, TKubeFailureKind> = {}

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

    public failureOf(clusterId: string): TKubeFailureKind | null {
        return this.failures[clusterId] ?? null
    }

    public isForbidden(clusterId: string): boolean {
        return this.failureOf(clusterId) === 'forbidden'
    }

    public loadFor(clusterId: string): Promise<void> {
        return clusterId in this.available ? Promise.resolve() : this.open(clusterId)
    }

    public async refresh(clusterId: string): Promise<void> {
        if (clusterId in this.available) {
            await this.read(clusterId)
        }
    }

    public forget(clusterId: string): void {
        void this.namespaceService.unwatch(clusterId)
        this.clearFailure(clusterId)
        if (!(clusterId in this.available)) {
            return
        }

        const remaining = { ...this.available }
        delete remaining[clusterId]
        this.available = remaining
    }

    private async open(clusterId: string): Promise<void> {
        const catalog = await this.read(clusterId)
        if (catalog) {
            await this.listen(clusterId, catalog.resourceVersion)
        }
    }

    private async listen(clusterId: string, resourceVersion: string): Promise<void> {
        try {
            await this.namespaceService.watch(clusterId, resourceVersion, {
                onChanges: changes => this.apply(clusterId, changes),
                onResync: () => void this.resync(clusterId),
                onStale: () => void this.read(clusterId),
            })
        } catch {
            // A cluster that refuses the stream still answers the list, and the picker has nowhere
            // to report it: it keeps what it read, and ClusterNamespaceHandler still refreshes it.
        }
    }

    private async resync(clusterId: string): Promise<void> {
        await this.namespaceService.unwatch(clusterId)
        await this.open(clusterId)
    }

    private apply(clusterId: string, changes: readonly TResourceChange[]): void {
        if (!(clusterId in this.available)) {
            return
        }

        const names = new Set(this.availableOf(clusterId))
        let touched = false

        changes.forEach((change) => {
            const namespace = change.entity
            if (!(namespace instanceof NamespaceEntity) || namespace.name === '') {
                return
            }

            if (change.type !== 'deleted' && namespace.phase === 'Active') {
                if (!names.has(namespace.name)) {
                    names.add(namespace.name)
                    touched = true
                }
                return
            }

            touched = names.delete(namespace.name) || touched
        })

        if (touched) {
            this.available = { ...this.available, [clusterId]: [...names].sort() }
        }
    }

    private async read(clusterId: string): Promise<TNamespaceCatalog | null> {
        if (!clusterId || this.isLoading(clusterId)) {
            return null
        }

        this.loadingIds = [...this.loadingIds, clusterId]
        try {
            const catalog = await this.namespaceService.list(clusterId)
            this.available = { ...this.available, [clusterId]: catalog.names }
            this.clearFailure(clusterId)

            return catalog
        } catch (err) {
            this.failures = { ...this.failures, [clusterId]: KubeStatusReader.kindOf(err) }
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ClusterNamespaceStore.read'))

            return null
        } finally {
            this.loadingIds = this.loadingIds.filter(id => id !== clusterId)
        }
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
