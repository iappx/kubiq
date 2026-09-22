import type { TArgoOperationInitiator } from '@/domain/entities/argocd/types/TArgoOperationInitiator'
import type { TArgoSyncOperation } from '@/domain/entities/argocd/types/TArgoSyncOperation'

export type TArgoOperation = {
    sync?: TArgoSyncOperation
    initiatedBy?: TArgoOperationInitiator
}
