import { inject, singleton } from 'tsyringe'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { DockTabClosedEvent } from '@/domain/events/dock/DockTabClosedEvent'
import { OpenPodLogsEvent } from '@/domain/events/cluster/OpenPodLogsEvent'
import { PodLogKey } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { DockStore } from '@/store/modules/dock/DockStore'
import { PodLogsStore } from '@/store/modules/podLogs/PodLogsStore'

@singleton()
export class PodLogsHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(AppUiStore) private readonly uiStore: AppUiStore,
        @inject(DockStore) private readonly dockStore: DockStore,
        @inject(PodLogsStore) private readonly podLogsStore: PodLogsStore,
    ) {
        this.eventBus.registerHandler(OpenPodLogsEvent, e => this.open(e))
        this.eventBus.registerHandler(ClusterDisconnectedEvent, e => this.forget(e.clusterId))
        this.eventBus.registerHandler(DockTabClosedEvent, e => this.closeTab(e.key))
    }

    private open(event: OpenPodLogsEvent): void {
        const key = PodLogKey.of(event.clusterId, event.namespace, event.podName, event.containerName)

        this.dockStore.open({
            key,
            label: PodLogsHandler.label(event.podName, event.containerName),
            clusterId: event.clusterId,
        })

        // A collapsed dock would swallow the tab just opened; collapsing it again stops no stream.
        this.uiStore.setDockCollapsed(false)

        void this.podLogsStore.openPod(
            event.clusterId,
            event.namespace,
            event.podName,
            event.containerName,
            event.previous,
        )
    }

    private closeTab(key: string): void {
        if (PodLogKey.isLog(key)) {
            void this.podLogsStore.close(key)
        }
    }

    private forget(clusterId: string): void {
        void this.podLogsStore.closeCluster(clusterId)
    }

    private static label(podName: string, container: string): string {
        return container === '' ? podName : `${podName}/${container}`
    }
}
