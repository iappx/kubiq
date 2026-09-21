import type { TMetricsState, TPrometheusLayout, TPrometheusTarget } from '@/domain/models/metrics'

export type TPrometheusTargetState = {
    state: TMetricsState
    target: TPrometheusTarget | null
    layout: TPrometheusLayout
    discovered: boolean
    loading: boolean
    loaded: boolean
}
