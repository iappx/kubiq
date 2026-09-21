import type { TMetricsSnapshot } from '@/application/services/metrics/types/TMetricsSnapshot'

export type TClusterMetricsState = {
    nodes: TMetricsSnapshot
    pods: TMetricsSnapshot
    loading: boolean
    loaded: boolean
}
