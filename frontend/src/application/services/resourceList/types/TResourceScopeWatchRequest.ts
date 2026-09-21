import type { KubeResourceKind } from '@/domain/models/kube'

export type TResourceScopeWatchRequest = {
    clusterId: string
    kind: KubeResourceKind
    namespace: string
    resourceVersion: string
    labelSelector?: string
    fieldSelector?: string
}
