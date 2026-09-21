import type { KubeResourceKind } from '@/domain/models/kube'

export type TWorkloadTarget = {
    clusterId: string
    kind: KubeResourceKind
    name: string
    namespace: string
    rowKey: string
}
