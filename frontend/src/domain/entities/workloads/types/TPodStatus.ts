import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'
import type { TKubeContainerStatus } from '@/domain/entities/workloads/types/TKubeContainerStatus'
import type { TPodPhase } from '@/domain/entities/workloads/types/TPodPhase'
import type { TPodQosClass } from '@/domain/entities/workloads/types/TPodQosClass'

export type TPodStatus = {
    phase?: TPodPhase
    reason?: string
    message?: string
    qosClass?: TPodQosClass
    podIP?: string
    hostIP?: string
    startTime?: string
    conditions?: TKubeCondition[]
    containerStatuses?: TKubeContainerStatus[]
    initContainerStatuses?: TKubeContainerStatus[]
}
