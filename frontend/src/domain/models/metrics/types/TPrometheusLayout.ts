import type { TPrometheusLayoutId } from '@/domain/models/metrics/types/TPrometheusLayoutId'

export type TPrometheusLayout = {
    id: TPrometheusLayoutId
    title: string
    description: string
    namespaceLabel: string
    podLabel: string
    containerLabel: string
    nodeLabel: string
    rateWindow: string
}
