import { inject, singleton } from 'tsyringe'
import { ToastService } from '@/application/services/toast/ToastService'
import { NamespaceCreatedEvent } from '@/domain/events/cluster/NamespaceCreatedEvent'
import { NodeDrainedEvent } from '@/domain/events/cluster/NodeDrainedEvent'
import { NodeSchedulingChangedEvent } from '@/domain/events/cluster/NodeSchedulingChangedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'

@singleton()
export class ClusterAdminNotificationHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ToastService) private readonly toastService: ToastService,
    ) {
        this.eventBus.registerHandler(NodeSchedulingChangedEvent, e => this.toastService.success(
            e.cordoned ? `Cordoned node ${e.name}` : `Uncordoned node ${e.name}`,
            e.cordoned
                ? 'The scheduler places no new pods here; the ones already running stay'
                : 'The scheduler can place pods here again',
        ))

        this.eventBus.registerHandler(NodeDrainedEvent, e => ClusterAdminNotificationHandler.reportDrain(
            this.toastService,
            e,
        ))

        this.eventBus.registerHandler(NamespaceCreatedEvent, e => this.toastService.success(
            `Created namespace ${e.name}`,
        ))
    }

    private static reportDrain(toastService: ToastService, event: NodeDrainedEvent): void {
        const detail = `${event.evicted} evicted, ${event.skipped} left in place`

        if (event.failed === 0) {
            toastService.success(`Drained node ${event.name}`, detail)
            return
        }

        toastService.show({
            type: 'warning',
            message: `Drained node ${event.name} with ${event.failed} ${event.failed === 1 ? 'refusal' : 'refusals'}`,
            description: `${detail}. A refusal is usually a PodDisruptionBudget — run the drain again once the budget allows it.`,
        })
    }
}
