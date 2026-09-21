import type {
    TMetricRange,
    TMetricScope,
    TMetricSeriesKind,
    TPrometheusLayout,
    TPrometheusTarget,
} from '@/domain/models/metrics'

export type TMetricSeriesRequest = {
    clusterId: string
    target: TPrometheusTarget
    layout: TPrometheusLayout
    kind: TMetricSeriesKind
    scope: TMetricScope
    range: TMetricRange
}
