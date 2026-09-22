import type { TArgoOperation } from '@/domain/entities/argocd/types/TArgoOperation'
import type { TArgoOperationPhase } from '@/domain/entities/argocd/types/TArgoOperationPhase'

export type TArgoOperationState = {
    phase?: TArgoOperationPhase
    message?: string
    startedAt?: string
    finishedAt?: string
    retryCount?: number
    operation?: TArgoOperation
}
