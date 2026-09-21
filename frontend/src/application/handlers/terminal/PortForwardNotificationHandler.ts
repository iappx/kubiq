import { inject, singleton } from 'tsyringe'
import { ToastService } from '@/application/services/toast/ToastService'
import { PortForwardStartedEvent } from '@/domain/events/terminal/PortForwardStartedEvent'
import { PortForwardStoppedEvent } from '@/domain/events/terminal/PortForwardStoppedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'

@singleton()
export class PortForwardNotificationHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ToastService) private readonly toastService: ToastService,
    ) {
        this.eventBus.registerHandler(PortForwardStartedEvent, e => this.toastService.success(
            `Forwarding ${e.label}`,
            `Listening on 127.0.0.1:${e.localPort}`,
        ))

        this.eventBus.registerHandler(PortForwardStoppedEvent, e => this.toastService.success(
            `Stopped forwarding ${e.label}`,
            `Port ${e.localPort} is free again`,
        ))
    }
}
