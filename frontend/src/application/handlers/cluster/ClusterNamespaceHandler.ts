import { inject, singleton } from 'tsyringe'
import { NamespaceCreatedEvent } from '@/domain/events/cluster/NamespaceCreatedEvent'
import { ResourceCreatedEvent } from '@/domain/events/cluster/ResourceCreatedEvent'
import { ResourceDeletedEvent } from '@/domain/events/cluster/ResourceDeletedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'

@singleton()
export class ClusterNamespaceHandler {
    private static readonly namespaceKind: string = 'Namespace'

    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ClusterNamespaceStore) private readonly namespaceStore: ClusterNamespaceStore,
    ) {
        this.eventBus.registerHandler(NamespaceCreatedEvent, e => this.refresh(e.clusterId))
        this.eventBus.registerHandler(ResourceCreatedEvent, e => this.refreshKind(e.clusterId, e.kindName))
        this.eventBus.registerHandler(ResourceDeletedEvent, e => this.refreshKind(e.clusterId, e.kindName))
    }

    private refreshKind(clusterId: string, kindName: string): void {
        if (kindName === ClusterNamespaceHandler.namespaceKind) {
            this.refresh(clusterId)
        }
    }

    private refresh(clusterId: string): void {
        void this.namespaceStore.refresh(clusterId)
    }
}
