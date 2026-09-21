import type { TPrometheusTarget } from '@/domain/models/metrics'

export type TPrometheusSearch = {
    target: TPrometheusTarget | null
    refused: boolean
}
