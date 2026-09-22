import type { TArgoHealthStatus } from '@/domain/entities/argocd/types/TArgoHealthStatus'
import type { TArgoOperationPhase } from '@/domain/entities/argocd/types/TArgoOperationPhase'
import type { TArgoSyncStatus } from '@/domain/entities/argocd/types/TArgoSyncStatus'

export type TArgoApplicationRow = {
    key: string
    name: string
    namespace: string
    project: string
    destination: string
    destinationNamespace: string
    repoUrl: string
    sourceText: string
    targetRevision: string
    syncStatus: TArgoSyncStatus
    syncText: string
    healthStatus: TArgoHealthStatus
    healthText: string
    syncPolicyText: string
    operationPhase?: TArgoOperationPhase
    isOperationRunning: boolean
    resourceCount: number
    createdAt: string
}
