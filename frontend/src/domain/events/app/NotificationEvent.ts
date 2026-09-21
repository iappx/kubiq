import { NotificationType } from '@/domain/events/app/NotificationType'

export type TNotificationOptions = {
    message: string
    description?: string
}

export class NotificationEvent {
    constructor(
        public readonly type: NotificationType,
        public readonly options: TNotificationOptions,
    ) {
    }
}
