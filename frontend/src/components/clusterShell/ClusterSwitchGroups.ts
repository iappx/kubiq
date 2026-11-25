import { ClusterChoices } from '@/components/cluster/ClusterChoices'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TClusterSwitchGroup } from '@/components/clusterShell/types/TClusterSwitchGroup'

export class ClusterSwitchGroups {
    public static build(rows: readonly TClusterRow[]): TClusterSwitchGroup[] {
        const ordered = ClusterChoices.ordered(rows)
        const connected = ordered.filter(row => row.isConnected)
        const disconnected = ordered.filter(row => !row.isConnected)
        const groups: TClusterSwitchGroup[] = []

        if (connected.length > 0) {
            groups.push({ key: 'connected', title: 'Connected', rows: connected })
        }
        if (disconnected.length > 0) {
            groups.push({ key: 'disconnected', title: 'Disconnected', rows: disconnected })
        }

        return groups
    }

    public static isUnhealthy(row: TClusterRow): boolean {
        return row.isConnected && row.status !== 'connected'
    }
}
