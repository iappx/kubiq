import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UiAgeTicker } from '@/components/common/time/UiAgeTicker'

describe('UiAgeTicker', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('drives every subscriber from one timer', () => {
        const interval = vi.spyOn(globalThis, 'setInterval')
        const listeners = Array.from({ length: 50 }, () => vi.fn())

        for (const listener of listeners) {
            UiAgeTicker.subscribe(listener)
        }

        expect(interval).toHaveBeenCalledOnce()
        expect(UiAgeTicker.count).toBe(50)

        vi.advanceTimersByTime(UiAgeTicker.intervalMs)
        for (const listener of listeners) {
            expect(listener).toHaveBeenCalledOnce()
            UiAgeTicker.unsubscribe(listener)
        }

        interval.mockRestore()
    })

    it('stops the timer when the last subscriber leaves and starts it again for the next', () => {
        const first = vi.fn()
        const second = vi.fn()

        UiAgeTicker.subscribe(first)
        UiAgeTicker.subscribe(second)
        UiAgeTicker.unsubscribe(first)

        expect(UiAgeTicker.running).toBe(true)

        UiAgeTicker.unsubscribe(second)
        expect(UiAgeTicker.running).toBe(false)

        vi.advanceTimersByTime(UiAgeTicker.intervalMs * 3)
        expect(second).not.toHaveBeenCalled()

        UiAgeTicker.subscribe(first)
        expect(UiAgeTicker.running).toBe(true)
        vi.advanceTimersByTime(UiAgeTicker.intervalMs)
        expect(first).toHaveBeenCalledOnce()

        UiAgeTicker.unsubscribe(first)
    })

    it('survives a subscriber unsubscribing from inside a tick', () => {
        const other = vi.fn()
        const leaver = vi.fn(() => UiAgeTicker.unsubscribe(leaver))

        UiAgeTicker.subscribe(leaver)
        UiAgeTicker.subscribe(other)
        vi.advanceTimersByTime(UiAgeTicker.intervalMs)

        expect(leaver).toHaveBeenCalledOnce()
        expect(other).toHaveBeenCalledOnce()

        UiAgeTicker.unsubscribe(other)
    })
})
