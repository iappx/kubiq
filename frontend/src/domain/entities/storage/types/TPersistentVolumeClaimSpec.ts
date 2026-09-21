import type { TKubeResourceList } from '@/domain/entities/kube/types/TKubeResourceList'

export type TPersistentVolumeClaimSpec = {
    accessModes?: string[]
    storageClassName?: string
    volumeMode?: string
    volumeName?: string
    resources?: {
        requests?: TKubeResourceList
        limits?: TKubeResourceList
    }
}
