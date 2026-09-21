import type { TResourceScopeCursor } from '@/application/services/resourceList/types/TResourceScopeCursor'
import type { KubeResourceKind } from '@/domain/models/kube'

export type TResourceWatchRequest = {
    clusterId: string
    kind: KubeResourceKind
    cursors: readonly TResourceScopeCursor[]
    labelSelector?: string
    fieldSelector?: string
    scope?: string
}
