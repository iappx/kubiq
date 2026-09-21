import type { TMetricsSnapshot } from '@/application/services/metrics/types/TMetricsSnapshot'
import type { TClusterMetricsState } from '@/store/modules/clusterMetrics/types/TClusterMetricsState'

export class ClusterMetricsStateFactory {
    public static empty(): TClusterMetricsState {
        return {
            nodes: ClusterMetricsStateFactory.snapshot(),
            pods: ClusterMetricsStateFactory.snapshot(),
            loading: false,
            loaded: false,
        }
    }

    public static snapshot(): TMetricsSnapshot {
        return { state: 'missing', usage: {}, readAt: 0 }
    }
}
