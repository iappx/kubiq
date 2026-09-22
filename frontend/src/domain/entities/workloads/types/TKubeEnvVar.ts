import type { TKubeEnvVarSource } from '@/domain/entities/workloads/types/TKubeEnvVarSource'

export type TKubeEnvVar = {
    name?: string
    value?: string
    valueFrom?: TKubeEnvVarSource
}
