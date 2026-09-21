import type { KubeResourceKind } from '@/domain/models/kube'

export type TResourceListRequest = {
    clusterId: string
    kind: KubeResourceKind
    namespaces?: readonly string[]
    labelSelector?: string
    fieldSelector?: string
    limit?: number
}
