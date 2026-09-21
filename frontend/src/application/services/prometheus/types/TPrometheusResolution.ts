import type { TMetricsState, TPrometheusLayout, TPrometheusTarget } from '@/domain/models/metrics'

export type TPrometheusResolution = {
    state: TMetricsState
    target: TPrometheusTarget | null
    layout: TPrometheusLayout
    discovered: boolean
}
