import type { TKubeObjectState } from '@/domain/entities/kube'

export type TNodeIssue = {
    name: string
    state: TKubeObjectState
    detail: string
}
