import { inject, singleton } from 'tsyringe'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { DockTabClosedEvent } from '@/domain/events/dock/DockTabClosedEvent'
import { OpenPortForwardEvent } from '@/domain/events/terminal/OpenPortForwardEvent'
import { PortForwardKey } from '@/domain/models/terminal'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { DockStore } from '@/store/modules/dock/DockStore'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'

@singleton()
export class PortForwardHandler {
    public static readonly tabLabel: string = 'Port forwards'

    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(AppUiStore) private readonly uiStore: AppUiStore,
        @inject(DockStore) private readonly dockStore: DockStore,
        @inject(PortForwardStore) private readonly portForwardStore: PortForwardStore,
    ) {
        this.eventBus.registerHandler(OpenPortForwardEvent, e => this.open(e))
        this.eventBus.registerHandler(DockTabClosedEvent, e => this.closeTab(e.key))
        this.eventBus.registerHandler(ClusterDisconnectedEvent, e => this.forget(e.clusterId))

        this.releaseOnExit()
    }

    private open(event: OpenPortForwardEvent): void {
        this.dockStore.open({
            key: PortForwardKey.of(event.clusterId),
            label: PortForwardHandler.tabLabel,
            clusterId: event.clusterId,
        })
        this.uiStore.setDockCollapsed(false)

        void this.portForwardStore.setTarget({
            clusterId: event.clusterId,
            namespace: event.namespace,
            resource: event.resource,
            name: event.name,
            remotePort: event.remotePort,
        })
    }

    // Closing the panel is not closing the forwards: they are listed there, not owned by it.
    private closeTab(key: string): void {
        if (PortForwardKey.isPortForward(key)) {
            void this.portForwardStore.setTarget(null)
        }
    }

    private forget(clusterId: string): void {
        void this.portForwardStore.closeCluster(clusterId)
    }

    private releaseOnExit(): void {
        if (typeof window === 'undefined') {
            return
        }

        window.addEventListener('beforeunload', () => {
            void this.portForwardStore.closeAll()
        })
    }
}
