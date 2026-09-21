import type { KubeResourceKind } from '@/domain/models/kube'

export type TNodeTarget = {
    clusterId: string
    kind: KubeResourceKind
    name: string
    rowKey: string
}
