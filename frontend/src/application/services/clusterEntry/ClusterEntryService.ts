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

    private readonly connecting = new Map<string, Promise<void>>()

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

    public async connectInBackground(clusterId: string): Promise<boolean> {
        const catalog = container.resolve(ClusterCatalogStore)
        const connections = container.resolve(ClusterConnectionStore)

        await catalog.loadOnce()
        await connections.adopt(catalog.items.map(context => context.name))

        if (catalog.loadError !== '' || !this.knows(clusterId)) {
            return false
        }

        await connections.loadScope(clusterId)
        if (!connections.isConnected(clusterId)) {
            await this.connectOnce(clusterId, catalog.sources, false)
        }

        return connections.isConnected(clusterId)
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

        connections.clearFailure(clusterId)

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
            await this.connectOnce(clusterId, catalog.sources, true)
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

    // The store drops a second connect while one is in flight, so a caller that must see the outcome joins the first.
    private connectOnce(clusterId: string, sources: readonly string[], activate: boolean): Promise<void> {
        const started = this.connecting.get(clusterId)
        if (started) {
            return started
        }

        const attempt = container.resolve(ClusterConnectionStore)
            .connect(clusterId, sources, activate)
            .finally(() => this.connecting.delete(clusterId))
        this.connecting.set(clusterId, attempt)

        return attempt
    }
}
