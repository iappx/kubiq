import { inject, singleton } from 'tsyringe'
import { KubeconfigService } from '@/application/services/kubeconfig/KubeconfigService'
import type { TClusterConnection } from '@/application/services/cluster/types/TClusterConnection'
import type { TClusterContextInfo } from '@/application/services/cluster/types/TClusterContextInfo'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeChannelSupport } from '@/domain/models/kube/discovery/KubeChannelSupport'
import type { KubeServerVersion } from '@/domain/models/kube/discovery/KubeServerVersion'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import type { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import type { KubeStreamTransport } from '@/infrastructure/entityRepo/kube/transport/KubeStreamTransport'
import { KubeSessionAdapter } from '@/infrastructure/kube/KubeSessionAdapter'
import { KubeStreamRegistry } from '@/infrastructure/kube/KubeStreamRegistry'
import { KubeVersionAdapter } from '@/infrastructure/kube/KubeVersionAdapter'
import type { IClusterStream } from '@/infrastructure/kube/types/IClusterStream'
import type { TKubeSession } from '@/infrastructure/kube/types/TKubeSession'

@singleton()
export class ClusterConnectionService {
    private static readonly notConnected = 'That cluster is not connected'

    private readonly live = new Map<string, TClusterConnection>()

    constructor(
        @inject(KubeconfigService) private readonly kubeconfigService: KubeconfigService,
        @inject(KubeSessionAdapter) private readonly sessionAdapter: KubeSessionAdapter,
        @inject(KubeContextProvider) private readonly contexts: KubeContextProvider,
        @inject(KubeStreamRegistry) private readonly streams: KubeStreamRegistry,
        @inject(KubeVersionAdapter) private readonly versions: KubeVersionAdapter,
    ) {}

    public async listContexts(extraPaths: readonly string[] = []): Promise<TClusterContextInfo[]> {
        const [contexts, currentName] = await Promise.all([
            this.kubeconfigService.getContexts(extraPaths),
            this.kubeconfigService.getCurrentContextName(extraPaths),
        ])

        return contexts.map(context => ({
            name: context.name,
            filePath: context.filePath,
            clusterName: context.clusterName,
            server: context.server,
            namespace: context.effectiveNamespace,
            authType: context.authType,
            isCurrent: context.name === currentName,
            isSupported: context.isSupported,
            unsupportedReason: context.unsupportedReason,
        }))
    }

    public async connect(contextName: string, extraPaths: readonly string[] = []): Promise<TClusterConnection> {
        const spec = await this.kubeconfigService.buildConnectionSpec(contextName, extraPaths)

        // A second connect to the same context must not strand the old session:
        // the Go side would keep it open with nothing left holding its id.
        if (this.live.has(contextName)) {
            await this.disconnect(contextName)
        }

        const sessionId = await this.sessionAdapter.connect(spec)
        const version = await this.versions.read(contextName, sessionId)

        const connection = ClusterConnectionService.describe(contextName, spec.server, sessionId, version)
        this.live.set(contextName, connection)

        return connection
    }

    public async disconnect(clusterId: string): Promise<TClusterConnection | null> {
        const connection = this.live.get(clusterId) ?? null
        if (!connection) {
            return null
        }

        // StopStream needs the session the Go side is about to forget, so streams drain first;
        // the release runs in `finally` or a dead session keeps answering through a cached context.
        await this.streams.drain(clusterId)
        try {
            await this.sessionAdapter.disconnect(connection.sessionId)
        } finally {
            this.contexts.release(clusterId)
            this.live.delete(clusterId)
        }

        return connection
    }

    public async disconnectAll(): Promise<void> {
        const ids = [...this.live.keys()]
        await Promise.allSettled(ids.map(clusterId => this.disconnect(clusterId)))
    }

    public get connections(): TClusterConnection[] {
        return [...this.live.values()]
    }

    public connection(clusterId: string): TClusterConnection | null {
        return this.live.get(clusterId) ?? null
    }

    public isConnected(clusterId: string): boolean {
        return this.live.has(clusterId)
    }

    public context(clusterId: string): KubeEntityContext {
        return this.contexts.context(clusterId, this.require(clusterId).sessionId)
    }

    public stream(clusterId: string): KubeStreamTransport {
        return this.contexts.stream(clusterId, this.require(clusterId).sessionId)
    }

    public registerStream(clusterId: string, stream: IClusterStream): () => void {
        return this.streams.register(clusterId, stream)
    }

    public openStreams(clusterId: string): number {
        return this.streams.count(clusterId)
    }

    public canOpenChannel(clusterId: string): boolean {
        return this.connection(clusterId)?.canOpenChannel === true
    }

    public assertChannelAllowed(clusterId: string): void {
        const connection = this.require(clusterId)
        if (connection.canOpenChannel) {
            return
        }

        throw new ApiError(connection.channelBlockReason, `Cluster ${clusterId} reports ${connection.version}`)
    }

    public sessions(): Promise<TKubeSession[]> {
        return this.sessionAdapter.sessions()
    }

    private require(clusterId: string): TClusterConnection {
        const connection = this.live.get(clusterId)
        if (!connection) {
            throw new ApiError(
                ClusterConnectionService.notConnected,
                `No open session for "${clusterId}" — connect to it from the cluster catalog first`,
            )
        }

        return connection
    }

    private static describe(
        contextName: string,
        server: string,
        sessionId: string,
        version: KubeServerVersion,
    ): TClusterConnection {
        return {
            clusterId: contextName,
            contextName,
            server,
            sessionId,
            version: version.text,
            canOpenChannel: KubeChannelSupport.isSupported(version),
            channelBlockReason: KubeChannelSupport.reason(version),
            connectedAt: Date.now(),
        }
    }
}
