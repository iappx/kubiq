import type { TKubeLocalObjectRef } from '@/domain/entities/kube/types/TKubeLocalObjectRef'

export type TKubePodVolume = {
    name?: string
    persistentVolumeClaim?: { claimName?: string; readOnly?: boolean }
    configMap?: TKubeLocalObjectRef
    secret?: { secretName?: string }
}
