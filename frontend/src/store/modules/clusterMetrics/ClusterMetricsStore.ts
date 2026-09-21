import { inject } from 'tsyringe'
import { MetricsService } from '@/application/services/metrics/MetricsService'
import type { TResourceUsage } from '@/application/services/metrics/types/TResourceUsage'
import { MetricsObjectKey } from '@/domain/entities/metrics'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import type { TMetricsState } from '@/domain/models/metrics'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'
import { ClusterMetricsStateFactory } from '@/store/modules/clusterMetrics/ClusterMetricsStateFactory'
import type { TClusterMetricsState } from '@/store/modules/clusterMetrics/types/TClusterMetricsState'

@InjectableStore
export class ClusterMetricsStore extends StoreBase<ClusterMetricsStore> {
    public clusters: Record<string, TClusterMetricsState> = {}

    constructor(
        @inject(MetricsService) private readonly metricsService: MetricsService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public stateOf(clusterId: string): TClusterMetricsState {
        return this.clusters[clusterId] ?? ClusterMetricsStateFactory.empty()
    }

    public usageState(clusterId: string): TMetricsState {
        const state = this.stateOf(clusterId)

        return state.nodes.state === 'ready' ? 'ready' : state.pods.state
    }

    public nodeUsage(clusterId: string, name: string): TResourceUsage | null {
        return this.stateOf(clusterId).nodes.usage[name] ?? null
    }

    public podUsage(clusterId: string, namespace: string, name: string): TResourceUsage | null {
        return this.stateOf(clusterId).pods.usage[MetricsObjectKey.of(namespace, name)] ?? null
    }

    public async load(clusterId: string, namespaces: readonly string[]): Promise<void> {
        if (clusterId === '') {
            return
        }

        this.patch(clusterId, { loading: true })
        try {
            const [nodes, pods] = await Promise.all([
                this.metricsService.nodeUsage(clusterId),
                this.metricsService.podUsage(clusterId, namespaces),
            ])
            this.patch(clusterId, { nodes, pods, loaded: true })
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ClusterMetricsStore.load'))
        } finally {
            this.patch(clusterId, { loading: false })
        }
    }

    public forget(clusterId: string): void {
        if (!(clusterId in this.clusters)) {
            return
        }

        const remaining = { ...this.clusters }
        delete remaining[clusterId]
        this.clusters = remaining
    }

    private patch(clusterId: string, changes: Partial<TClusterMetricsState>): void {
        const current = this.clusters[clusterId] ?? ClusterMetricsStateFactory.empty()

        this.clusters = { ...this.clusters, [clusterId]: { ...current, ...changes } }
    }
}
