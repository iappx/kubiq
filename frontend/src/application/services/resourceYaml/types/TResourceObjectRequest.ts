import type { KubeResourceKind } from '@/domain/models/kube'

export type TResourceObjectRequest = {
    clusterId: string
    kind: KubeResourceKind
    name: string
    namespace: string
}
