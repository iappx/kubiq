import type { THelmOperationKind } from '@/application/services/helm/types/THelmOperationKind'
import type { THelmOperationState } from '@/store/modules/helm/types/THelmOperationState'

export type THelmOperationView = {
    key: string
    kind: THelmOperationKind
    title: string
    clusterId: string
    namespace: string
    releaseName: string
    chart: string
    targetRevision: number
    state: THelmOperationState
    code: number
    lineCount: number
    revision: number
}
