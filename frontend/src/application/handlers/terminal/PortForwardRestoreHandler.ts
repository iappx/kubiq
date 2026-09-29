import { inject, singleton } from 'tsyringe'
import { ClusterConnectedEvent } from '@/domain/events/cluster/ClusterConnectedEvent'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'

@singleton()
export class PortForwardRestoreHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(PortForwardStore) private readonly portForwardStore: PortForwardStore,
    ) {
        this.eventBus.registerHandler(ClusterConnectedEvent, e => void this.portForwardStore.onClusterConnected(e.clusterId))
        this.eventBus.registerHandler(ClusterDisconnectedEvent, e => void this.portForwardStore.onClusterDisconnected(e.clusterId))

        this.releaseOnExit()

        void this.portForwardStore.restore()
    }

    private releaseOnExit(): void {
        if (typeof window === 'undefined') {
            return
        }

        window.addEventListener('beforeunload', () => {
            void this.portForwardStore.stopAll()
        })
    }
}
