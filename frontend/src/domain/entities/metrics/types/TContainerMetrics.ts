import type { TMetricsUsage } from '@/domain/entities/metrics/types/TMetricsUsage'

export type TContainerMetrics = {
    name?: string
    usage?: TMetricsUsage
}
