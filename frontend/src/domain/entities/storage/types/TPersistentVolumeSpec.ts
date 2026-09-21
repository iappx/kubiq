import type { TKubeObjectRef } from '@/domain/entities/kube/types/TKubeObjectRef'
import type { TKubeResourceList } from '@/domain/entities/kube/types/TKubeResourceList'

export type TPersistentVolumeSpec = {
    capacity?: TKubeResourceList
    accessModes?: string[]
    storageClassName?: string
    volumeMode?: string
    persistentVolumeReclaimPolicy?: string
    claimRef?: TKubeObjectRef
}
