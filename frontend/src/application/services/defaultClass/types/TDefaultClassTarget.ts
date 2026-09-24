import type { KubeResourceKind } from '@/domain/models/kube'

export type TDefaultClassTarget = {
    clusterId: string
    kind: KubeResourceKind
    name: string
    rowKey: string
}
