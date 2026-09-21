import type { KubeResourceKind } from '@/domain/models/kube'

export type TObjectEventsRequest = {
    clusterId: string
    // The kind of the object the events are about, not the Event kind.
    kind: KubeResourceKind
    name: string
    namespace: string
    uid: string
    served: readonly KubeResourceKind[]
}
