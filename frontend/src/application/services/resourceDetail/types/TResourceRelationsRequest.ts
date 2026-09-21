import type { KubeResourceKind } from '@/domain/models/kube'

export type TResourceRelationsRequest = {
    clusterId: string
    kind: KubeResourceKind
    object: Record<string, unknown>
    served: readonly KubeResourceKind[]
}
