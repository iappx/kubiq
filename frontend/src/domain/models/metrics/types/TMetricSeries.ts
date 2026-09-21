import type { TMetricPoint } from '@/domain/models/metrics/types/TMetricPoint'

export type TMetricSeries = {
    key: string
    label: string
    points: TMetricPoint[]
}
