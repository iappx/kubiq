import type { TArgoResourceHealth } from '@/domain/entities/argocd/types/TArgoResourceHealth'
import type { TArgoSyncStatus } from '@/domain/entities/argocd/types/TArgoSyncStatus'

export type TArgoResourceStatus = {
    group?: string
    version?: string
    kind?: string
    namespace?: string
    name?: string
    status?: TArgoSyncStatus
    health?: TArgoResourceHealth
    hook?: boolean
    requiresPruning?: boolean
}
