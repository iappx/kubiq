import type { KubeResourceKind } from '@/domain/models/kube'

export type TResourceObjectRef = {
    clusterId: string
    kind: KubeResourceKind
    name: string
    namespace: string
    served: readonly KubeResourceKind[]
}
