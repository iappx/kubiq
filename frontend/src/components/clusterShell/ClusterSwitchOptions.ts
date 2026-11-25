import { ClusterChoices } from '@/components/cluster/ClusterChoices'
import { ClusterToneMap } from '@/components/cluster/ClusterToneMap'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'

export class ClusterSwitchOptions {
    public static readonly catalogKey: string = 'catalog'

    // Contexts are named by whoever wrote the kubeconfig, so an unprefixed key would let a context
    // named "catalog" open the catalog instead of the cluster.
    private static readonly clusterPrefix: string = 'cluster:'

    public static build(rows: readonly TClusterRow[]): TUiMenuItem[] {
        const ordered = ClusterChoices.ordered(rows)
        const clusters = ordered.map((row, index) => ({
            key: ClusterSwitchOptions.keyOf(row.clusterId),
            label: row.displayName,
            tone: ClusterToneMap.of(row.status),
            hint: ClusterChoices.hintOf(row),
            separatorBefore: index > 0 && ordered[index - 1].isConnected && !row.isConnected,
            groupLabel: ClusterSwitchOptions.groupLabelOf(ordered, index),
        }))

        return [
            ...clusters,
            {
                key: ClusterSwitchOptions.catalogKey,
                label: 'Cluster catalog',
                separatorBefore: clusters.length > 0,
            },
        ]
    }

    public static clusterIdOf(key: string): string {
        return key.startsWith(ClusterSwitchOptions.clusterPrefix)
            ? key.slice(ClusterSwitchOptions.clusterPrefix.length)
            : ''
    }

    private static keyOf(clusterId: string): string {
        return `${ClusterSwitchOptions.clusterPrefix}${clusterId}`
    }

    private static groupLabelOf(ordered: readonly TClusterRow[], index: number): string | undefined {
        const row = ordered[index]
        if (index === 0) {
            return row.isConnected ? 'Connected' : 'Disconnected'
        }
        if (ordered[index - 1].isConnected && !row.isConnected) {
            return 'Disconnected'
        }

        return undefined
    }
}
