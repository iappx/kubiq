import type { TClusterConnection } from '@/application/services/cluster/types/TClusterConnection'
import type { TClusterContextInfo } from '@/application/services/cluster/types/TClusterContextInfo'

export type TClusterRowInput = {
    contexts: readonly TClusterContextInfo[]
    connections: readonly TClusterConnection[]
    pinned: readonly string[]
    connectingIds: readonly string[]
    failures: Readonly<Record<string, string>>
    activeClusterId: string
}
