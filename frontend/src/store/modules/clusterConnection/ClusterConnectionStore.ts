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
    public connections: TClusterConnection[] = []

    public activeClusterId = ''

    public connectingIds: string[] = []

    public failures: Record<string, string> = {}

    public namespaces: Record<string, string[]> = {}

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

    public namespacesOf(clusterId: string): string[] {
        return this.namespaces[clusterId] ?? []
    }

    public loadNamespaces(): Promise<void> {
        return this.guard('ClusterConnectionStore.loadNamespaces', async () => {
            this.namespaces = await this.namespaceService.getSelections()
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
                this.connections = [
                    ...this.connections.filter(open => open.clusterId !== clusterId),
                    connection,
                ]
                this.clearFailure(clusterId)
                this.activeClusterId = clusterId
                this.namespaces = {
                    ...this.namespaces,
                    [clusterId]: await this.namespaceService.getSelection(clusterId),
                }
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
            this.namespaces = { ...this.namespaces, [clusterId]: stored }
            this.eventBus.emitEvent(new ClusterNamespacesChangedEvent(clusterId, stored))
        })
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
