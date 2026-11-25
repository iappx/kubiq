import { inject, singleton } from 'tsyringe'
import { ToastService } from '@/application/services/toast/ToastService'
import { BulkActionCompletedEvent } from '@/domain/events/cluster/BulkActionCompletedEvent'
import { ResourceAppliedEvent } from '@/domain/events/cluster/ResourceAppliedEvent'
import { ResourceCreatedEvent } from '@/domain/events/cluster/ResourceCreatedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'

@singleton()
export class ResourceNotificationHandler {
    private static readonly pastTense: Record<BulkActionCompletedEvent['action'], string> = {
        delete: 'Deleted',
        restart: 'Restarted',
        cordon: 'Cordoned',
        uncordon: 'Uncordoned',
    }

    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ToastService) private readonly toastService: ToastService,
    ) {
        this.eventBus.registerHandler(ResourceAppliedEvent, e => this.toastService.success(
            `Applied ${e.kindName} ${ResourceNotificationHandler.objectOf(e.name, e.namespace)}`,
            e.replaced ? 'The whole object was replaced' : 'Only the changed fields were sent',
        ))

        this.eventBus.registerHandler(ResourceCreatedEvent, e => this.toastService.success(
            `Created ${e.kindName} ${ResourceNotificationHandler.objectOf(e.name, e.namespace)}`,
        ))

        this.eventBus.registerHandler(BulkActionCompletedEvent, e => this.announceBulk(e))
    }

    private announceBulk(event: BulkActionCompletedEvent): void {
        const verb = ResourceNotificationHandler.pastTense[event.action]
        const total = event.succeeded + event.failed

        if (event.failed === 0) {
            const label = event.succeeded === 1 ? event.kindName : event.kindTitle
            this.toastService.success(`${verb} ${event.succeeded} ${label}`)
            return
        }

        if (event.succeeded === 0) {
            const label = event.failed === 1 ? event.kindName : event.kindTitle
            this.toastService.error(`Could not ${event.action} ${event.failed} ${label}`)
            return
        }

        this.toastService.show({
            type: 'warning',
            message: `${verb} ${event.succeeded} of ${total} ${event.kindTitle}`,
            description: `${event.failed} failed`,
        })
    }

    private static objectOf(name: string, namespace: string): string {
        return namespace === '' ? name : `${namespace}/${name}`
    }
}
