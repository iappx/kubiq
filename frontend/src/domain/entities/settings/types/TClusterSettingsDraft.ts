import type { TPrometheusSource } from '@/domain/entities/settings/types/TPrometheusSource'
import type { TPrometheusLayoutId } from '@/domain/models/metrics'

export type TClusterSettingsDraft = {
    clusterId: string
    prometheusSource: TPrometheusSource
    prometheusUrl: string
    prometheusService: string
    prometheusLayout: TPrometheusLayoutId
}
