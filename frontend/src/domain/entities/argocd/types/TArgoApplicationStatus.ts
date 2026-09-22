import type { TArgoApplicationCondition } from '@/domain/entities/argocd/types/TArgoApplicationCondition'
import type { TArgoHealthSummary } from '@/domain/entities/argocd/types/TArgoHealthSummary'
import type { TArgoOperationState } from '@/domain/entities/argocd/types/TArgoOperationState'
import type { TArgoResourceStatus } from '@/domain/entities/argocd/types/TArgoResourceStatus'
import type { TArgoRevisionHistory } from '@/domain/entities/argocd/types/TArgoRevisionHistory'
import type { TArgoSyncSummary } from '@/domain/entities/argocd/types/TArgoSyncSummary'

export type TArgoApplicationStatus = {
    sync?: TArgoSyncSummary
    health?: TArgoHealthSummary
    conditions?: TArgoApplicationCondition[]
    resources?: TArgoResourceStatus[]
    history?: TArgoRevisionHistory[]
    operationState?: TArgoOperationState
    reconciledAt?: string
    sourceType?: string
}
