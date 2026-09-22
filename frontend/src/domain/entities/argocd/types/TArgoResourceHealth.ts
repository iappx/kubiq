import type { TArgoHealthStatus } from '@/domain/entities/argocd/types/TArgoHealthStatus'

export type TArgoResourceHealth = {
    status?: TArgoHealthStatus
    message?: string
}
