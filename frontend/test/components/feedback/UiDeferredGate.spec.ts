import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UiDeferredGate } from '@/components/common/feedback/UiDeferredGate'

describe('UiDeferredGate', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('shows nothing for a load that finishes inside the threshold', () => {
        const gate = new UiDeferredGate()
        const reveal = vi.fn()

        gate.start(UiDeferredGate.defaultDelayMs, reveal)
        vi.advanceTimersByTime(299)
        gate.cancel()
        vi.advanceTimersByTime(1000)

        expect(reveal).not.toHaveBeenCalled()
    })

    it('reveals the skeleton once the threshold has passed', () => {
        const gate = new UiDeferredGate()
        const reveal = vi.fn()

        gate.start(UiDeferredGate.defaultDelayMs, reveal)
        vi.advanceTimersByTime(299)
        expect(reveal).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(reveal).toHaveBeenCalledOnce()
    })

    it('defaults to the 300 ms threshold the brief sets', () => {
        expect(UiDeferredGate.defaultDelayMs).toBe(300)
    })

    it('restarts rather than stacking when a second load begins', () => {
        const gate = new UiDeferredGate()
        const first = vi.fn()
        const second = vi.fn()

        gate.start(300, first)
        vi.advanceTimersByTime(200)
        gate.start(300, second)
        vi.advanceTimersByTime(299)

        expect(first).not.toHaveBeenCalled()
        expect(second).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(second).toHaveBeenCalledOnce()
    })

    it('reports whether it is still counting down', () => {
        const gate = new UiDeferredGate()

        expect(gate.pending).toBe(false)

        gate.start(300, () => {})
        expect(gate.pending).toBe(true)

        vi.advanceTimersByTime(300)
        expect(gate.pending).toBe(false)
    })
})
