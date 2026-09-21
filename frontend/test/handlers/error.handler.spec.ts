import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'
import { ErrorHandler } from '@/application/handlers/ErrorHandler'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ToastStore } from '@/store/modules/toast/ToastStore'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'

// Resolved once: the handler subscribes in its constructor, so a per-test
// resolution would leave earlier instances listening on the same bus.
container.resolve(ErrorHandler)
const eventBus = container.resolve(EventBus)
const store = container.resolve(ToastStore)

describe('ErrorHandler', () => {
    beforeEach(() => {
        store.items = []
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('shows a business error to the user', () => {
        eventBus.emitEvent(new AppErrorEvent(new ApiError('Could not load the data', 'timeout')))

        expect(store.items).toHaveLength(1)
        expect(store.items[0].type).toBe('error')
        expect(store.items[0].message).toBe('Could not load the data')
        expect(store.items[0].description).toBe('timeout')
        expect(console.error).not.toHaveBeenCalled()
    })

    it('logs anything else instead of interrupting the user', () => {
        const bug = new TypeError('cannot read property of undefined')

        eventBus.emitEvent(new AppErrorEvent(bug, 'ClusterStore.init'))

        expect(store.items).toHaveLength(0)
        expect(console.error).toHaveBeenCalledWith('ClusterStore.init', bug)
    })
})
