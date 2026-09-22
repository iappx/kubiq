import { inject } from 'tsyringe'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { ClusterNamespaceService } from '@/application/services/clusterNamespace/ClusterNamespaceService'
import type { TClusterConnection } from '@/application/services/cluster/types/TClusterConnection'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ClusterActivatedEvent } from '@/domain/events/cluster/ClusterActivatedEvent'
import { ClusterConnectedEvent } from '@/domain/events/cluster/ClusterConnectedEvent'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { ClusterNamespacesChangedEvent } from '@/domain/events/cluster/ClusterNamespacesChangedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class ClusterConnectionStore extends StoreBase<ClusterConnectionStore> {
    // One instance, so a cluster whose scope is unknown reads the same value every time and
    // nothing downstream mistakes a fresh [] for a change worth re-listing over.
    private static readonly everyNamespace: string[] = []

    public connections: TClusterConnection[] = []

    public activeClusterId = ''

    public connectingIds: string[] = []

    public failures: Record<string, string> = {}

    public namespaces: Record<string, string[]> = {}

    public adopted = false

    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(ClusterNamespaceService) private readonly namespaceService: ClusterNamespaceService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public get active(): TClusterConnection | null {
        return this.connections.find(connection => connection.clusterId === this.activeClusterId) ?? null
    }

    public get hasConnections(): boolean {
        return this.connections.length > 0
    }

    public isConnected(clusterId: string): boolean {
        return this.connections.some(connection => connection.clusterId === clusterId)
    }

    public isConnecting(clusterId: string): boolean {
        return this.connectingIds.includes(clusterId)
    }

    public failureOf(clusterId: string): string {
        return this.failures[clusterId] ?? ''
    }

    // A missing entry is a scope nobody has read yet; an empty one is the operator asking for every
    // namespace. Reading them as the same value is what sends a list cluster-wide by accident.
    public isScopeKnown(clusterId: string): boolean {
        return clusterId in this.namespaces
    }

    public namespacesOf(clusterId: string): string[] {
        return this.namespaces[clusterId] ?? ClusterConnectionStore.everyNamespace
    }

    public loadNamespaces(): Promise<void> {
        return this.guard('ClusterConnectionStore.loadNamespaces', async () => {
            const stored = await this.namespaceService.getSelections()

            // What is already held was read for one cluster and is no older than this; letting the
            // whole-map read win would swap every array for an equal one and re-list each screen.
            this.namespaces = { ...stored, ...this.namespaces }
        })
    }

    public async loadScope(clusterId: string): Promise<void> {
        if (this.isScopeKnown(clusterId)) {
            return
        }

        try {
            this.rememberScope(clusterId, await this.namespaceService.getSelection(clusterId))
        } catch (err) {
            // A scope that cannot be read leaves every screen wider than the operator asked for, so
            // it is worth saying — but the shell cannot wait for an answer that is not coming.
            this.rememberScope(clusterId, [])
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ClusterConnectionStore.loadScope'))
        }
    }

    public adopt(contextNames: readonly string[]): Promise<void> {
        return this.guard('ClusterConnectionStore.adopt', async () => {
            if (this.adopted) {
                return
            }

            this.adopted = true
            const reclaimed = await this.connectionService.adopt(contextNames)
            if (reclaimed.length === 0) {
                return
            }

            await Promise.all(reclaimed.map(connection => this.loadScope(connection.clusterId)))

            this.connections = [
                ...this.connections.filter(open => !reclaimed.some(taken => taken.clusterId === open.clusterId)),
                ...reclaimed,
            ]
            reclaimed.forEach(connection => this.eventBus.emitEvent(
                new ClusterConnectedEvent(connection.clusterId, connection.contextName, connection.version),
            ))
        })
    }

    public connect(clusterId: string, extraPaths: readonly string[] = []): Promise<void> {
        return this.guard('ClusterConnectionStore.connect', async () => {
            if (this.isConnecting(clusterId)) {
                return
            }

            this.connectingIds = [...this.connectingIds, clusterId]
            try {
                const connection = await this.connectionService.connect(clusterId, extraPaths)
                const scope = await this.namespaceService.getSelection(clusterId)

                // Nothing between here and the event may await: a cluster that reads as connected
                // while its scope is still unknown is a list already on its way to every namespace.
                this.rememberScope(clusterId, scope)
                this.connections = [
                    ...this.connections.filter(open => open.clusterId !== clusterId),
                    connection,
                ]
                this.clearFailure(clusterId)
                this.activeClusterId = clusterId
                this.eventBus.emitEvent(
                    new ClusterConnectedEvent(clusterId, connection.contextName, connection.version),
                )
            } catch (err) {
                this.rememberFailure(clusterId, err)
                throw err
            } finally {
                this.connectingIds = this.connectingIds.filter(id => id !== clusterId)
            }
        })
    }

    public disconnect(clusterId: string): Promise<void> {
        return this.guard('ClusterConnectionStore.disconnect', async () => {
            const stoppedStreams = this.connectionService.openStreams(clusterId)
            const closed = await this.connectionService.disconnect(clusterId)
            if (!closed) {
                return
            }

            this.connections = this.connections.filter(open => open.clusterId !== clusterId)
            if (this.activeClusterId === clusterId) {
                this.activeClusterId = this.connections[0]?.clusterId ?? ''
            }

            this.eventBus.emitEvent(
                new ClusterDisconnectedEvent(clusterId, closed.contextName, stoppedStreams),
            )
        })
    }

    public disconnectAll(): Promise<void> {
        return this.guard('ClusterConnectionStore.disconnectAll', async () => {
            await this.connectionService.disconnectAll()
            this.connections = []
            this.activeClusterId = ''
        })
    }

    public activate(clusterId: string): void {
        if (!this.isConnected(clusterId) || this.activeClusterId === clusterId) {
            return
        }

        this.activeClusterId = clusterId
        const connection = this.connections.find(open => open.clusterId === clusterId)
        this.eventBus.emitEvent(new ClusterActivatedEvent(clusterId, connection?.contextName ?? clusterId))
    }

    public setNamespaces(clusterId: string, namespaces: readonly string[]): Promise<void> {
        return this.guard('ClusterConnectionStore.setNamespaces', async () => {
            const stored = await this.namespaceService.setSelection(clusterId, namespaces)
            this.rememberScope(clusterId, stored)
            this.eventBus.emitEvent(new ClusterNamespacesChangedEvent(clusterId, stored))
        })
    }

    private rememberScope(clusterId: string, namespaces: string[]): void {
        if (ClusterConnectionStore.sameScope(this.namespaces[clusterId], namespaces)) {
            return
        }

        this.namespaces = { ...this.namespaces, [clusterId]: namespaces }
    }

    private static sameScope(known: string[] | undefined, fresh: readonly string[]): boolean {
        return known !== undefined
            && known.length === fresh.length
            && known.every((namespace, index) => namespace === fresh[index])
    }

    private rememberFailure(clusterId: string, err: unknown): void {
        this.failures = {
            ...this.failures,
            [clusterId]: err instanceof ApiError ? err.message : 'The cluster could not be reached',
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

    private async guard(context: string, action: () => Promise<void>): Promise<void> {
        try {
            await action()
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, context))
        }
    }
}
