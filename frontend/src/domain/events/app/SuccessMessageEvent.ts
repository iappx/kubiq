import { AppMessageEvent } from '@/domain/events/app/AppMessageEvent'
import { NotificationType } from '@/domain/events/app/NotificationType'

export class SuccessMessageEvent extends AppMessageEvent {
    constructor(content: string) {
        super(NotificationType.Success, content)
    }
}
