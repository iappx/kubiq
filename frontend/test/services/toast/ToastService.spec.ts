import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'
import { ToastService } from '@/application/services/toast/ToastService'
import { ToastStore } from '@/store/modules/toast/ToastStore'

// Singletons resolved once per file: a second resolution would hand the service
// a different store than the one the assertions read.
const service = container.resolve(ToastService)
const store = container.resolve(ToastStore)

describe('ToastService', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        store.items = []
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('puts the toast on screen with an id of its own', () => {
        service.success('Saved')

        expect(store.items).toHaveLength(1)
        expect(store.items[0].type).toBe('success')
        expect(store.items[0].message).toBe('Saved')
        expect(store.items[0].id).toBeTruthy()
    })

    it('keeps the technical detail as the description', () => {
        service.error('Could not save', 'disk is full')

        expect(store.items[0].description).toBe('disk is full')
    })

    it('takes the toast away again on its own', () => {
        service.success('Saved')

        vi.advanceTimersByTime(4000)

        expect(store.items).toHaveLength(0)
    })

    it('dismisses each toast separately', () => {
        service.success('First')
        vi.advanceTimersByTime(1000)
        service.success('Second')

        vi.advanceTimersByTime(3000)

        expect(store.items.map(t => t.message)).toEqual(['Second'])
    })
})
