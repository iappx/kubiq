import { inject, singleton } from 'tsyringe'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { DockStore } from '@/store/modules/dock/DockStore'

@singleton()
export class DockSessionHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(DockStore) private readonly dockStore: DockStore,
    ) {
        this.eventBus.registerHandler(ClusterDisconnectedEvent, e => this.dockStore.closeCluster(e.clusterId))
    }
}
