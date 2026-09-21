import type { KubeResourceKind } from '@/domain/models/kube'
import type { TClusterConnection } from '@/application/services/cluster/types/TClusterConnection'

export type TCommandPaletteInput = {
    clusterId: string
    connections: readonly TClusterConnection[]
    kinds: readonly KubeResourceKind[]
    namespaces: readonly string[]
}
