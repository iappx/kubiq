import type { TKubeEnvSourceRef } from '@/domain/entities/workloads/types/TKubeEnvSourceRef'

export type TKubeEnvFromSource = {
    prefix?: string
    configMapRef?: TKubeEnvSourceRef
    secretRef?: TKubeEnvSourceRef
}
