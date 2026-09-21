import type { TPrometheusSource } from '@/domain/entities/settings/types/TPrometheusSource'

export type TClusterSettingsDraft = {
    clusterId: string
    prometheusSource: TPrometheusSource
    prometheusUrl: string
    prometheusService: string
}
