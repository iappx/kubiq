import { inject, singleton } from 'tsyringe'
import { ToastService } from '@/application/services/toast/ToastService'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
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
    }

    private static streamSummary(stopped: number): string | undefined {
        if (stopped === 0) {
            return undefined
        }

        return stopped === 1 ? 'One open stream was stopped' : `${stopped} open streams were stopped`
    }
}
