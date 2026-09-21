import type { TClusterEvent } from '@/application/services/clusterOverview/types/TClusterEvent'
import type { TNodeHealth } from '@/application/services/clusterOverview/types/TNodeHealth'
import type { TWorkloadSummary } from '@/application/services/clusterOverview/types/TWorkloadSummary'

export type TClusterOverview = {
    workloads: TWorkloadSummary[]
    nodes: TNodeHealth
    events: TClusterEvent[]
    eventsError: string
}
