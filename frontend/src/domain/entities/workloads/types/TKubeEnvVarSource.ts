import type { TKubeEnvKeyRef } from '@/domain/entities/workloads/types/TKubeEnvKeyRef'
import type { TKubeFieldRef } from '@/domain/entities/workloads/types/TKubeFieldRef'
import type { TKubeResourceFieldRef } from '@/domain/entities/workloads/types/TKubeResourceFieldRef'

export type TKubeEnvVarSource = {
    configMapKeyRef?: TKubeEnvKeyRef
    secretKeyRef?: TKubeEnvKeyRef
    fieldRef?: TKubeFieldRef
    resourceFieldRef?: TKubeResourceFieldRef
}
