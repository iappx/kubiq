import { container, singleton } from 'tsyringe'
import { ClusterEntryPhase } from '@/application/services/clusterEntry/models/ClusterEntryPhase'
import type { TClusterEntryPhase } from '@/application/services/clusterEntry/types/TClusterEntryPhase'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { ClusterCatalogStore } from '@/store/modules/clusterCatalog/ClusterCatalogStore'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'

@singleton()
export class ClusterEntryService {
    private readonly running = new Map<string, Promise<TClusterEntryPhase>>()

    public enter(clusterId: string): Promise<TClusterEntryPhase> {
        const started = this.running.get(clusterId)
        if (started) {
            return started
        }

        const sequence = this.run(clusterId).finally(() => this.running.delete(clusterId))
        this.running.set(clusterId, sequence)

        return sequence
    }

    public async retry(clusterId: string): Promise<TClusterEntryPhase> {
        await container.resolve(ClusterCatalogStore).refresh()

        return this.enter(clusterId)
    }

    public phaseOf(clusterId: string): TClusterEntryPhase {
        const catalog = container.resolve(ClusterCatalogStore)
        const connections = container.resolve(ClusterConnectionStore)

        return ClusterEntryPhase.of({
            catalogLoaded: catalog.storeLoaded,
            catalogFailure: catalog.loadError,
            known: this.knows(clusterId),
            connected: connections.isConnected(clusterId),
            connecting: connections.isConnecting(clusterId),
            scoped: connections.isScopeKnown(clusterId),
            failure: connections.failureOf(clusterId),
        })
    }

    public failureOf(clusterId: string): string {
        const catalogFailure = container.resolve(ClusterCatalogStore).loadError

        return catalogFailure === ''
            ? container.resolve(ClusterConnectionStore).failureOf(clusterId)
            : catalogFailure
    }

    private knows(clusterId: string): boolean {
        return container.resolve(ClusterCatalogStore).items.some(context => context.name === clusterId)
    }

    private async run(clusterId: string): Promise<TClusterEntryPhase> {
        if (clusterId === '') {
            return 'unknown'
        }

        const catalog = container.resolve(ClusterCatalogStore)
        const connections = container.resolve(ClusterConnectionStore)

        await catalog.loadOnce()
        await connections.adopt(catalog.items.map(context => context.name))

        if (catalog.loadError !== '') {
            return 'failed'
        }
        if (!this.knows(clusterId)) {
            return 'unknown'
        }

        await connections.loadNamespaces()
        await connections.loadScope(clusterId)

        if (!connections.isConnected(clusterId)) {
            await connections.connect(clusterId, catalog.sources)
        }
        if (!connections.isConnected(clusterId)) {
            return 'failed'
        }

        connections.activate(clusterId)
        container.resolve(AppUiStore).setLastClusterId(clusterId)

        await Promise.all([
            container.resolve(ClusterDiscoveryStore).loadOnce(clusterId),
            container.resolve(ClusterNamespaceStore).loadFor(clusterId),
        ])

        return 'ready'
    }
}
