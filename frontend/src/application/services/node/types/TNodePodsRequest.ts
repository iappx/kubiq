import type { KubeResourceKind } from '@/domain/models/kube'

export type TNodePodsRequest = {
    clusterId: string
    podsKind: KubeResourceKind
    nodeName: string
}
