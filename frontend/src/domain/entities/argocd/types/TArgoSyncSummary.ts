import type { TArgoSyncStatus } from '@/domain/entities/argocd/types/TArgoSyncStatus'

export type TArgoSyncSummary = {
    status?: TArgoSyncStatus
    revision?: string
    revisions?: string[]
}
