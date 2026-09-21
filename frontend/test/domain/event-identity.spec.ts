import { describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { TypeIdentity } from '@/lib/extendedTypes/TypeIdentity'
import { NotificationEvent } from '@/domain/events/app/NotificationEvent'
import { ErrorNotificationEvent } from '@/domain/events/app/ErrorNotificationEvent'
import { NotificationType } from '@/domain/events/app/NotificationType'

const eventBus = container.resolve(EventBus)

describe('event identity', () => {
    it('gives a subclass an identity of its own', () => {
        // Both are read here, in this order, precisely because a shared
        // identity would only show up once the base class has been touched.
        expect(TypeIdentity.guid(NotificationEvent)).not.toBe(TypeIdentity.guid(ErrorNotificationEvent))
    })

    it('keeps the same identity across calls', () => {
        expect(TypeIdentity.guid(ErrorNotificationEvent)).toBe(TypeIdentity.guid(ErrorNotificationEvent))
    })

    it('does not deliver a subclass event to handlers of its base', () => {
        const onBase = vi.fn()
        const onSubclass = vi.fn()

        eventBus.registerHandler(NotificationEvent, onBase)
        eventBus.registerHandler(ErrorNotificationEvent, onSubclass)

        eventBus.emitEvent(new ErrorNotificationEvent({ message: 'Error' }))

        expect(onSubclass).toHaveBeenCalledTimes(1)
        expect(onBase).not.toHaveBeenCalled()

        eventBus.unregisterHandler(NotificationEvent, onBase)
        eventBus.unregisterHandler(ErrorNotificationEvent, onSubclass)
    })

    it('stops calling a handler once it is unregistered', () => {
        const handler = vi.fn()

        eventBus.registerHandler(NotificationEvent, handler)
        eventBus.emitEvent(new NotificationEvent(NotificationType.Info, { message: 'First' }))
        eventBus.unregisterHandler(NotificationEvent, handler)
        eventBus.emitEvent(new NotificationEvent(NotificationType.Info, { message: 'Second' }))

        expect(handler).toHaveBeenCalledTimes(1)
    })
})
