import { inject, singleton } from 'tsyringe'
import { ClusterRemovedEvent } from '@/domain/events/cluster/ClusterRemovedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'

@singleton()
export class ClusterRemovalHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ClusterConnectionStore) private readonly connectionStore: ClusterConnectionStore,
    ) {
        this.eventBus.registerHandler(ClusterRemovedEvent, e => this.close(e.contextNames))
    }

    private close(contextNames: readonly string[]): void {
        contextNames
            .filter(contextName => this.connectionStore.isConnected(contextName))
            .forEach(contextName => void this.connectionStore.disconnect(contextName))
    }
}
