import type { TArgoApplicationDestination } from '@/domain/entities/argocd/types/TArgoApplicationDestination'
import type { TArgoApplicationSource } from '@/domain/entities/argocd/types/TArgoApplicationSource'
import type { TArgoSyncPolicy } from '@/domain/entities/argocd/types/TArgoSyncPolicy'

export type TArgoApplicationSpec = {
    project?: string
    source?: TArgoApplicationSource
    sources?: TArgoApplicationSource[]
    destination?: TArgoApplicationDestination
    syncPolicy?: TArgoSyncPolicy
    revisionHistoryLimit?: number
}
