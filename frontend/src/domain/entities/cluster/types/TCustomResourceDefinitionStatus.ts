import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'

export type TCustomResourceDefinitionStatus = {
    conditions?: TKubeCondition[]
    storedVersions?: string[]
}
