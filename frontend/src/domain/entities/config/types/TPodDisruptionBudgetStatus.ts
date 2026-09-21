import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'

export type TPodDisruptionBudgetStatus = {
    currentHealthy?: number
    desiredHealthy?: number
    expectedPods?: number
    disruptionsAllowed?: number
    conditions?: TKubeCondition[]
}
