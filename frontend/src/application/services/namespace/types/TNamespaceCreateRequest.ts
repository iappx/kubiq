import type { KubeResourceKind } from '@/domain/models/kube'

export type TNamespaceCreateRequest = {
    clusterId: string
    kind: KubeResourceKind
    name: string
}
