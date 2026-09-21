import type { TKubeLabelSelector } from '@/domain/entities/kube/types/TKubeLabelSelector'

export type TNetworkPolicySpec = {
    podSelector?: TKubeLabelSelector
    policyTypes?: string[]
    ingress?: Record<string, unknown>[]
    egress?: Record<string, unknown>[]
}
