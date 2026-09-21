import { inject, singleton } from 'tsyringe'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ToastService } from '@/application/services/toast/ToastService'
import { ApiError } from '@/domain/errors/ApiError'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'

@singleton()
export class ErrorHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ToastService) private readonly toastService: ToastService,
    ) {
        this.eventBus.registerHandler(AppErrorEvent, e => this.handle(e))
    }

    private handle(event: AppErrorEvent): void {
        if (event.error instanceof ApiError) {
            this.toastService.error(event.error.message, event.error.details)
            return
        }

        console.error(event.context ?? 'Unhandled error', event.error)
    }
}
