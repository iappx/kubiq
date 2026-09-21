import type { TMetricScope, TMetricSeriesKind } from '@/domain/models/metrics'

export type TMetricsChartRequest = {
    clusterId: string
    scope: TMetricScope
    kind: TMetricSeriesKind
}
