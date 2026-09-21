import { inject, singleton } from 'tsyringe'
import { KubeSchemaService } from '@/application/services/kubeSchema/KubeSchemaService'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'
import { ClusterOverviewStore } from '@/store/modules/clusterOverview/ClusterOverviewStore'
import { ClusterResourceStore } from '@/store/modules/clusterResource/ClusterResourceStore'
import { CustomResourceKindStore } from '@/store/modules/customResourceKind/CustomResourceKindStore'
import { HelmRepositoryStore } from '@/store/modules/helm/HelmRepositoryStore'
import { HelmStore } from '@/store/modules/helm/HelmStore'
import { NodeStore } from '@/store/modules/node/NodeStore'
import { ResourceObjectStore } from '@/store/modules/resourceObject/ResourceObjectStore'

@singleton()
export class ClusterSessionHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ClusterNamespaceStore) private readonly namespaceStore: ClusterNamespaceStore,
        @inject(ClusterDiscoveryStore) private readonly discoveryStore: ClusterDiscoveryStore,
        @inject(ClusterResourceStore) private readonly resourceStore: ClusterResourceStore,
        @inject(ClusterOverviewStore) private readonly overviewStore: ClusterOverviewStore,
        @inject(ResourceObjectStore) private readonly objectStore: ResourceObjectStore,
        @inject(NodeStore) private readonly nodeStore: NodeStore,
        @inject(CustomResourceKindStore) private readonly customKindStore: CustomResourceKindStore,
        @inject(HelmStore) private readonly helmStore: HelmStore,
        @inject(HelmRepositoryStore) private readonly helmRepositoryStore: HelmRepositoryStore,
        @inject(KubeSchemaService) private readonly schemaService: KubeSchemaService,
    ) {
        this.eventBus.registerHandler(ClusterDisconnectedEvent, e => this.forget(e.clusterId))
    }

    private forget(clusterId: string): void {
        this.namespaceStore.forget(clusterId)
        this.discoveryStore.forget(clusterId)
        this.resourceStore.forget(clusterId)
        this.overviewStore.forget(clusterId)
        this.objectStore.forget(clusterId)
        this.nodeStore.forget(clusterId)
        this.customKindStore.forget(clusterId)
        this.helmStore.forget(clusterId)
        this.helmRepositoryStore.forget(clusterId)
        this.schemaService.forget(clusterId)
    }
}
