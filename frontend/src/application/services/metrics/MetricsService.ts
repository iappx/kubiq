import { inject, injectable } from 'tsyringe'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import type { TMetricsSnapshot } from '@/application/services/metrics/types/TMetricsSnapshot'
import type { TResourceUsage } from '@/application/services/metrics/types/TResourceUsage'
import { MetricsObjectKey, NodeMetricsEntity, PodMetricsEntity } from '@/domain/entities/metrics'
import type { TMetricsState } from '@/domain/models/metrics'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'
import type { MetricsEntityContext } from '@/infrastructure/entityRepo/metrics/MetricsEntityContext'

@injectable()
export class MetricsService {
    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(KubeContextProvider) private readonly contexts: KubeContextProvider,
    ) {}

    public async nodeUsage(clusterId: string): Promise<TMetricsSnapshot> {
        const context = this.context(clusterId)
        if (!context) {
            return MetricsService.unavailable('missing')
        }

        try {
            const rows = await context.nodes.getAll()

            return MetricsService.ready(rows.map(row => MetricsService.nodeEntry(row)))
        } catch (err) {
            return MetricsService.failed(err)
        }
    }

    public async podUsage(clusterId: string, namespaces: readonly string[]): Promise<TMetricsSnapshot> {
        const context = this.context(clusterId)
        if (!context) {
            return MetricsService.unavailable('missing')
        }

        const scopes = namespaces.length > 0 ? [...namespaces] : ['']
        try {
            const pages = await Promise.all(scopes.map(namespace => MetricsService.pods(context, namespace)))

            return MetricsService.ready(pages.flat().map(row => MetricsService.podEntry(row)))
        } catch (err) {
            return MetricsService.failed(err)
        }
    }

    private context(clusterId: string): MetricsEntityContext | null {
        const connection = this.connectionService.connection(clusterId)

        return connection ? this.contexts.metrics(clusterId, connection.sessionId) : null
    }

    private static pods(context: MetricsEntityContext, namespace: string): Promise<PodMetricsEntity[]> {
        const query = namespace === ''
            ? context.pods
            : context.pods.withPathParams({ [KubeUrlBuilder.namespaceParam]: namespace })

        return query.getAll()
    }

    private static nodeEntry(row: NodeMetricsEntity): [string, TResourceUsage] {
        return [row.name, { cpuCores: row.cpuCores, memoryBytes: row.memoryBytes }]
    }

    private static podEntry(row: PodMetricsEntity): [string, TResourceUsage] {
        return [
            MetricsObjectKey.of(row.namespace, row.name),
            { cpuCores: row.cpuCores, memoryBytes: row.memoryBytes },
        ]
    }

    private static ready(entries: [string, TResourceUsage][]): TMetricsSnapshot {
        const usage: Record<string, TResourceUsage> = {}
        entries.forEach(([key, value]) => {
            if (key !== '') {
                usage[key] = value
            }
        })

        return { state: 'ready', usage, readAt: Date.now() }
    }

    // A cluster with no metrics-server answers 404, and one whose API service is not
    // ready yet answers 503. Neither is a failure worth interrupting the user with.
    private static failed(err: unknown): TMetricsSnapshot {
        if (KubeStatusReader.isAbsent(err)) {
            return MetricsService.unavailable('missing')
        }
        if (KubeStatusReader.isForbidden(err)) {
            return MetricsService.unavailable('forbidden')
        }

        throw err
    }

    private static unavailable(state: TMetricsState): TMetricsSnapshot {
        return { state, usage: {}, readAt: Date.now() }
    }
}
