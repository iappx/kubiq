import type { TArgoHealthStatus } from '@/domain/entities/argocd/types/TArgoHealthStatus'

export type TArgoHealthSummary = {
    status?: TArgoHealthStatus
    message?: string
}
