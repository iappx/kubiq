import { NotificationEvent, TNotificationOptions } from '@/domain/events/app/NotificationEvent'
import { NotificationType } from '@/domain/events/app/NotificationType'

export class ErrorNotificationEvent extends NotificationEvent {
    constructor(options: TNotificationOptions) {
        super(NotificationType.Error, options)
    }
}
