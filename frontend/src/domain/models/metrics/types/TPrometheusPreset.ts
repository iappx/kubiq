import type { TPrometheusLayoutId } from '@/domain/models/metrics/types/TPrometheusLayoutId'

export type TPrometheusPreset = {
    id: TPrometheusLayoutId
    title: string
    labelSelector: string
    portNames: string[]
    portNumbers: number[]
}
