import type { TClusterEvent } from '@/application/services/clusterOverview/types/TClusterEvent'

export type TEventNamespaceGroup = {
    namespace: string
    label: string
    events: TClusterEvent[]
    count: number
}
