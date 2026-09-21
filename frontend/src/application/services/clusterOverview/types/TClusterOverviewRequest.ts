import type { KubeResourceKind } from '@/domain/models/kube'

export type TClusterOverviewRequest = {
    clusterId: string
    kinds: readonly KubeResourceKind[]
    namespaces: readonly string[]
}
