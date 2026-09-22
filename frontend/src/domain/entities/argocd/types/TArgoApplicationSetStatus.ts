import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'

export type TArgoApplicationSetStatus = {
    conditions?: TKubeCondition[]
}
