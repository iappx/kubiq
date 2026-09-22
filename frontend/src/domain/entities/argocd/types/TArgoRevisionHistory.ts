import type { TArgoApplicationSource } from '@/domain/entities/argocd/types/TArgoApplicationSource'

export type TArgoRevisionHistory = {
    id?: number
    revision?: string
    deployedAt?: string
    deployStartedAt?: string
    source?: TArgoApplicationSource
}
