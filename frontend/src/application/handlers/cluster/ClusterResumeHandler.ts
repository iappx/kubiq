import { inject, singleton } from 'tsyringe'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { AppConnectivityEvent } from '@/domain/events/app/AppConnectivityEvent'
import { AppResumedEvent } from '@/domain/events/app/AppResumedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeHealthMonitor } from '@/infrastructure/kube/KubeHealthMonitor'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'
import { ClusterHealthStore } from '@/store/modules/clusterHealth/ClusterHealthStore'

@singleton()
export class ClusterResumeHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(ClusterConnectionStore) private readonly connectionStore: ClusterConnectionStore,
        @inject(ClusterDiscoveryStore) private readonly discoveryStore: ClusterDiscoveryStore,
        @inject(ClusterHealthStore) private readonly healthStore: ClusterHealthStore,
        @inject(KubeHealthMonitor) private readonly healthMonitor: KubeHealthMonitor,
    ) {
        this.eventBus.registerHandler(AppResumedEvent, () => void this.recover())
        this.eventBus.registerHandler(AppConnectivityEvent, (event) => {
            if (event.online) {
                void this.recover()
            }
        })
    }

    private async recover(): Promise<void> {
        await this.connectionService.resetIdle()

        const clusterIds = this.connectionStore.connections.map(connection => connection.clusterId)
        await Promise.allSettled(clusterIds.map(clusterId => this.recoverCluster(clusterId)))
    }

    private async recoverCluster(clusterId: string): Promise<void> {
        const health = this.healthStore.healthOf(clusterId)
        if (health === 'degraded' || health === 'unreachable') {
            const reachable = await this.connectionService.probe(clusterId)
            if (!reachable) {
                return
            }

            this.healthMonitor.succeeded(clusterId)
        }

        if (this.needsDiscovery(clusterId)) {
            await this.discoveryStore.reload(clusterId)
        }
    }

    private needsDiscovery(clusterId: string): boolean {
        return this.discoveryStore.failureOf(clusterId) !== ''
            || this.discoveryStore.kindsOf(clusterId).length === 0
    }
}
