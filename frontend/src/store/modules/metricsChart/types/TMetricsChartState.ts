import type { TMetricSeries } from '@/domain/models/metrics'

export type TMetricsChartState = {
    series: TMetricSeries[]
    loading: boolean
    loaded: boolean
    error: string
    errorDetail: string
}
