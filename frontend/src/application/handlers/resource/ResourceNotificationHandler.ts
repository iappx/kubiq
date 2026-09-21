import { inject, singleton } from 'tsyringe'
import { ToastService } from '@/application/services/toast/ToastService'
import { ResourceAppliedEvent } from '@/domain/events/cluster/ResourceAppliedEvent'
import { ResourceCreatedEvent } from '@/domain/events/cluster/ResourceCreatedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'

@singleton()
export class ResourceNotificationHandler {
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
    }

    private static objectOf(name: string, namespace: string): string {
        return namespace === '' ? name : `${namespace}/${name}`
    }
}
