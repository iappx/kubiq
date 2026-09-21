import { inject, singleton } from 'tsyringe'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { DockTabClosedEvent } from '@/domain/events/dock/DockTabClosedEvent'
import { OpenLocalShellEvent } from '@/domain/events/terminal/OpenLocalShellEvent'
import { OpenNodeShellEvent } from '@/domain/events/terminal/OpenNodeShellEvent'
import { OpenPodShellEvent } from '@/domain/events/terminal/OpenPodShellEvent'
import { TerminalKey } from '@/domain/models/terminal'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { DockStore } from '@/store/modules/dock/DockStore'
import { TerminalStore } from '@/store/modules/terminal/TerminalStore'

@singleton()
export class TerminalHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(AppUiStore) private readonly uiStore: AppUiStore,
        @inject(DockStore) private readonly dockStore: DockStore,
        @inject(TerminalStore) private readonly terminalStore: TerminalStore,
    ) {
        this.eventBus.registerHandler(OpenPodShellEvent, e => this.openExec(e))
        this.eventBus.registerHandler(OpenNodeShellEvent, e => this.openNodeShell(e))
        this.eventBus.registerHandler(OpenLocalShellEvent, e => this.openLocalShell(e))
        this.eventBus.registerHandler(DockTabClosedEvent, e => this.closeTab(e.key))
        this.eventBus.registerHandler(ClusterDisconnectedEvent, e => this.forget(e.clusterId))

        this.releaseOnExit()
    }

    private openExec(event: OpenPodShellEvent): void {
        const key = this.terminalStore.openExec(event.clusterId, event.namespace, event.podName, event.containerName)

        this.show(key, event.clusterId)
    }

    private openNodeShell(event: OpenNodeShellEvent): void {
        const key = this.terminalStore.openNodeShell(event.clusterId, event.nodeName)

        this.show(key, event.clusterId)
    }

    private openLocalShell(event: OpenLocalShellEvent): void {
        const key = this.terminalStore.openLocalShell(event.clusterId, event.namespace)

        this.show(key, event.clusterId)
    }

    private show(key: string, clusterId: string): void {
        const view = this.terminalStore.viewOf(key)

        this.dockStore.open({ key, label: view?.title ?? key, clusterId })
        this.uiStore.setDockCollapsed(false)
    }

    private closeTab(key: string): void {
        if (TerminalKey.isTerminal(key)) {
            void this.terminalStore.close(key)
        }
    }

    private forget(clusterId: string): void {
        void this.terminalStore.closeCluster(clusterId)
    }

    // A node shell keeps a privileged pod alive; the window going away is the last
    // chance this side has to ask for it to be removed.
    private releaseOnExit(): void {
        if (typeof window === 'undefined') {
            return
        }

        window.addEventListener('beforeunload', () => {
            void this.terminalStore.closeAll()
        })
    }
}
