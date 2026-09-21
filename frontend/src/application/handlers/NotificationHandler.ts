import { inject, singleton } from 'tsyringe'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ToastService } from '@/application/services/toast/ToastService'
import { ErrorNotificationEvent } from '@/domain/events/app/ErrorNotificationEvent'
import { SuccessMessageEvent } from '@/domain/events/app/SuccessMessageEvent'

@singleton()
export class NotificationHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ToastService) private readonly toastService: ToastService,
    ) {
        this.eventBus.registerHandler(ErrorNotificationEvent, e => this.toastService.error(
            e.options.message,
            e.options.description,
        ))

        this.eventBus.registerHandler(SuccessMessageEvent, e => this.toastService.success(e.content))
    }
}
