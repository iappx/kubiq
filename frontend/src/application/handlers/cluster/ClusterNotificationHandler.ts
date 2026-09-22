import { inject, singleton } from 'tsyringe'
import { ToastService } from '@/application/services/toast/ToastService'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { ClusterRemovedEvent } from '@/domain/events/cluster/ClusterRemovedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'

@singleton()
export class ClusterNotificationHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ToastService) private readonly toastService: ToastService,
    ) {
        this.eventBus.registerHandler(ClusterDisconnectedEvent, e => this.toastService.success(
            `Disconnected from ${e.contextName}`,
            ClusterNotificationHandler.streamSummary(e.stoppedStreams),
        ))

        this.eventBus.registerHandler(ClusterRemovedEvent, e => this.toastService.success(
            ClusterNotificationHandler.removalSummary(e.contextNames),
            ClusterNotificationHandler.kubeconfigFate(e.filePath, e.kubeconfigDeleted),
        ))
    }

    private static streamSummary(stopped: number): string | undefined {
        if (stopped === 0) {
            return undefined
        }

        return stopped === 1 ? 'One open stream was stopped' : `${stopped} open streams were stopped`
    }

    private static removalSummary(contextNames: readonly string[]): string {
        if (contextNames.length === 0) {
            return 'Removed kubeconfig'
        }

        if (contextNames.length === 1) {
            return `Deleted cluster ${contextNames[0]}`
        }

        return `Deleted ${contextNames.length} clusters`
    }

    private static kubeconfigFate(filePath: string, deleted: boolean): string {
        return deleted
            ? 'The kubeconfig Kubiq saved for it was deleted too'
            : `${filePath} was left on disk`
    }
}
