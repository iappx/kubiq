import { ClusterRowBuilder } from '@/components/cluster/ClusterRowBuilder'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { ClusterCatalogStore } from '@/store/modules/clusterCatalog/ClusterCatalogStore'
import type { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'
import type { ClusterHealthStore } from '@/store/modules/clusterHealth/ClusterHealthStore'

export class ClusterRowSource {
    public static build(
        catalog: ClusterCatalogStore,
        connections: ClusterConnectionStore,
        health: ClusterHealthStore,
    ): TClusterRow[] {
        return ClusterRowBuilder.build({
            contexts: catalog.items,
            connections: connections.connections,
            pinned: catalog.pinned,
            sourceOrigins: catalog.sourceOrigins,
            connectingIds: connections.connectingIds,
            failures: connections.failures,
            health: health.health,
            activeClusterId: connections.activeClusterId,
        })
    }
}
