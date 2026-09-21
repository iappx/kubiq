import type { TKubeConditionStatus } from '@/domain/entities/kube/types/TKubeConditionStatus'

export type TKubeCondition = {
    type: string
    status: TKubeConditionStatus
    reason?: string
    message?: string
    /** RFC 3339 timestamp. */
    lastTransitionTime?: string
    /** RFC 3339 timestamp. */
    lastProbeTime?: string
}
