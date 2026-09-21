import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'
import type { TKubeResourceList } from '@/domain/entities/kube/types/TKubeResourceList'
import type { TPersistentVolumeClaimPhase } from '@/domain/entities/storage/types/TPersistentVolumeClaimPhase'

export type TPersistentVolumeClaimStatus = {
    phase?: TPersistentVolumeClaimPhase
    accessModes?: string[]
    capacity?: TKubeResourceList
    conditions?: TKubeCondition[]
}
