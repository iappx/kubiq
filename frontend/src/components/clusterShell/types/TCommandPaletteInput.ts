import type { KubeResourceKind } from '@/domain/models/kube'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'

export type TCommandPaletteInput = {
    clusterId: string
    clusters: readonly TClusterRow[]
    kinds: readonly KubeResourceKind[]
    namespaces: readonly string[]
}
