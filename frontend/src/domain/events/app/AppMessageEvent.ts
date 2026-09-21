import { NotificationType } from '@/domain/events/app/NotificationType'

export class AppMessageEvent {
    constructor(
        public readonly type: NotificationType,
        public readonly content: string,
    ) {
    }
}
