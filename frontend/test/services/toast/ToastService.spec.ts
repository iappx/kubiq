import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'
import { ToastService } from '@/application/services/toast/ToastService'
import { ToastStore } from '@/store/modules/toast/ToastStore'

// Resolved once: a second resolution would hand the service a different store than the
// one the assertions read.
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

    it('keeps an error on screen until it is dismissed', () => {
        service.error('Could not list Pods')

        vi.advanceTimersByTime(60000)

        expect(store.items).toHaveLength(1)
    })

    it('counts a refusal repeated across ten screens instead of stacking ten toasts', () => {
        for (let i = 0; i < 10; i++) {
            service.error('The cluster denied access to this resource')
        }

        expect(store.items).toHaveLength(1)
        expect(store.items[0].count).toBe(10)
    })

    it('keeps different failures apart', () => {
        service.error('Could not list Pods')
        service.error('Could not list Secrets')

        expect(store.items).toHaveLength(2)
        expect(store.items.every(item => item.count === 1)).toBe(true)
    })

    it('separates the same text raised as a success and as a failure', () => {
        service.success('Deleted')
        service.error('Deleted')

        expect(store.items).toHaveLength(2)
    })

    it('shows the repeat again once the first one has gone', () => {
        service.success('Saved')
        vi.advanceTimersByTime(4000)
        service.success('Saved')

        expect(store.items).toHaveLength(1)
        expect(store.items[0].count).toBe(1)
    })

    it('shows the repeat again after the user dismissed it by hand', () => {
        service.error('Could not list Pods')
        store.remove(store.items[0].id)

        service.error('Could not list Pods')

        expect(store.items).toHaveLength(1)
    })

    it('drops the oldest rather than filling the screen with errors', () => {
        for (let i = 0; i < 8; i++) {
            service.error(`Failure ${i}`)
        }

        expect(store.items).toHaveLength(5)
        expect(store.items.map(t => t.message)).toEqual(['Failure 3', 'Failure 4', 'Failure 5', 'Failure 6', 'Failure 7'])
    })

    it('lets a dropped message raise a toast again', () => {
        for (let i = 0; i < 8; i++) {
            service.error(`Failure ${i}`)
        }

        service.error('Failure 0')

        expect(store.items.map(t => t.message)).toContain('Failure 0')
    })
})
