import type { KubeResourceKind } from '@/domain/models/kube'

export type TArgoApplicationTarget = {
    clusterId: string
    kind: KubeResourceKind
    namespace: string
    name: string
}
