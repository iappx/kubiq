import type { KubeResourceKind } from '@/domain/models/kube'

export type TRelatedObject = {
    key: string
    kindName: string
    name: string
    namespace: string
    kind: KubeResourceKind | null
    detail: string
}
