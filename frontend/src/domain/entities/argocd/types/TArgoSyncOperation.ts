import type { TArgoApplicationSource } from '@/domain/entities/argocd/types/TArgoApplicationSource'

export type TArgoSyncOperation = {
    revision?: string
    prune?: boolean
    dryRun?: boolean
    syncOptions?: string[]
    source?: TArgoApplicationSource
}
