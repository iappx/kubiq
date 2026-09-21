import type { TMetricLevel } from '@/domain/models/metrics/types/TMetricLevel'

export type TMetricScope = {
    level: TMetricLevel
    namespace?: string
    node?: string
    pod?: string
    workload?: string
}
