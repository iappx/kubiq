import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'
import type { TKubeResourceList } from '@/domain/entities/kube/types/TKubeResourceList'
import type { TNodeAddress } from '@/domain/entities/cluster/types/TNodeAddress'
import type { TNodeSystemInfo } from '@/domain/entities/cluster/types/TNodeSystemInfo'

export type TNodeStatus = {
    capacity?: TKubeResourceList
    allocatable?: TKubeResourceList
    conditions?: TKubeCondition[]
    addresses?: TNodeAddress[]
    nodeInfo?: TNodeSystemInfo
}
