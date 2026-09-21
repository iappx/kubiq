import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'
import type { TNamespacePhase } from '@/domain/entities/cluster/types/TNamespacePhase'

export type TNamespaceStatus = {
    phase?: TNamespacePhase
    conditions?: TKubeCondition[]
}
