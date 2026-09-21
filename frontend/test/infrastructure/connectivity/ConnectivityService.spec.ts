import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppConnectivityEvent } from '@/domain/events/app/AppConnectivityEvent'
import { AppResumedEvent } from '@/domain/events/app/AppResumedEvent'
import { ConnectivityService } from '@/infrastructure/connectivity/ConnectivityService'
import { ConnectivityLimits } from '@/infrastructure/connectivity/constants/ConnectivityLimits'
import { EventBus } from '@/infrastructure/eventBus/EventBus'

let bus: EventBus
let service: ConnectivityService
let resumed: AppResumedEvent[]
let connectivity: AppConnectivityEvent[]

const sleepFor = (ms: number): void => {
    vi.setSystemTime(Date.now() + ms)
    service.checkGap()
}

describe('ConnectivityService', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-09-22T10:00:00Z'))

        bus = new EventBus()
        service = new ConnectivityService(bus)
        resumed = []
        connectivity = []
        bus.registerHandler(AppResumedEvent, e => void resumed.push(e))
        bus.registerHandler(AppConnectivityEvent, e => void connectivity.push(e))

        service.start()
    })

    afterEach(() => {
        service.stop()
        vi.useRealTimers()
    })

    it('starts out believing the machine is online', () => {
        expect(service.isOnline).toBe(true)
        expect(connectivity).toEqual([])
    })

    it('says nothing when the beat arrives on time', () => {
        vi.advanceTimersByTime(ConnectivityLimits.heartbeatMs * 4)

        expect(resumed).toEqual([])
    })

    it('reports a resume when a beat arrives far later than its period', () => {
        sleepFor(ConnectivityLimits.heartbeatMs + ConnectivityLimits.sleepToleranceMs + 1)

        expect(resumed).toHaveLength(1)
        expect(resumed[0].asleepMs).toBeGreaterThan(ConnectivityLimits.sleepToleranceMs)
    })

    it('leaves a late-but-plausible beat alone', () => {
        sleepFor(ConnectivityLimits.heartbeatMs + ConnectivityLimits.sleepToleranceMs - 1)

        expect(resumed).toEqual([])
    })

    it('does not report the same sleep twice', () => {
        sleepFor(ConnectivityLimits.heartbeatMs + ConnectivityLimits.sleepToleranceMs + 1)
        service.checkGap()

        expect(resumed).toHaveLength(1)
    })

    it('announces the network going away and coming back', () => {
        window.dispatchEvent(new Event('offline'))
        expect(service.isOnline).toBe(false)

        window.dispatchEvent(new Event('online'))
        expect(service.isOnline).toBe(true)

        expect(connectivity.map(e => e.online)).toEqual([false, true])
    })

    it('says nothing when the state it is told is the state it holds', () => {
        window.dispatchEvent(new Event('online'))

        expect(connectivity).toEqual([])
    })

    it('does not mistake the offline stretch for a sleep', () => {
        window.dispatchEvent(new Event('offline'))
        vi.setSystemTime(Date.now() + ConnectivityLimits.heartbeatMs)
        service.checkGap()

        expect(resumed).toEqual([])
    })

    it('stops listening once it is stopped', () => {
        service.stop()

        window.dispatchEvent(new Event('offline'))

        expect(connectivity).toEqual([])
    })

    it('starting twice leaves one heartbeat running', () => {
        service.start()
        sleepFor(ConnectivityLimits.heartbeatMs + ConnectivityLimits.sleepToleranceMs + 1)

        expect(resumed).toHaveLength(1)
    })
})
