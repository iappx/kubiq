import type { TMetricsState } from '@/domain/models/metrics'
import type { TResourceUsage } from '@/application/services/metrics/types/TResourceUsage'

export type TMetricsSnapshot = {
    state: TMetricsState
    usage: Record<string, TResourceUsage>
    readAt: number
}
