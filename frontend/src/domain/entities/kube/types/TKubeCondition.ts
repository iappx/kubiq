import type { TKubeConditionStatus } from '@/domain/entities/kube/types/TKubeConditionStatus'

export type TKubeCondition = {
    type: string
    status: TKubeConditionStatus
    reason?: string
    message?: string
    lastTransitionTime?: string
    lastProbeTime?: string
}
