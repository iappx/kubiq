import type { TClusterEvent } from '@/application/services/clusterOverview/types/TClusterEvent'
import type { TNodeHealth } from '@/application/services/clusterOverview/types/TNodeHealth'
import type { TWorkloadSummary } from '@/application/services/clusterOverview/types/TWorkloadSummary'
import type { PodEntity } from '@/domain/entities/workloads'
import type { TClusterCapacitySummary } from '@/domain/models/metrics'

export type TClusterOverview = {
    workloads: TWorkloadSummary[]
    nodes: TNodeHealth
    events: TClusterEvent[]
    eventsError: string
    capacity: TClusterCapacitySummary
    pods: PodEntity[]
}
