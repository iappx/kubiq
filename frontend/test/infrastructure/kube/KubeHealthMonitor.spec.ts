import { beforeEach, describe, expect, it } from 'vitest'
import { ClusterHealthChangedEvent } from '@/domain/events/cluster/ClusterHealthChangedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeHealthMonitor } from '@/infrastructure/kube/KubeHealthMonitor'

let bus: EventBus
let monitor: KubeHealthMonitor
let announced: ClusterHealthChangedEvent[]

const refused = (status: number, message = 'refused'): ApiError => new ApiError(message, '', status)

const failTwice = (clusterId: string, error: ApiError): void => {
    monitor.failed(clusterId, error)
    monitor.failed(clusterId, error)
}

describe('KubeHealthMonitor', () => {
    beforeEach(() => {
        bus = new EventBus()
        monitor = new KubeHealthMonitor(bus)
        announced = []
        bus.registerHandler(ClusterHealthChangedEvent, e => void announced.push(e))
    })

    it('treats a cluster nobody asked about as healthy', () => {
        expect(monitor.healthOf('prod')).toBe('healthy')
        expect(announced).toEqual([])
    })

    it('calls the credentials expired on the very first 401', () => {
        monitor.failed('prod', refused(401, 'The cluster rejected the credentials.'))

        expect(monitor.healthOf('prod')).toBe('expired')
        expect(announced).toHaveLength(1)
        expect(announced[0].clusterId).toBe('prod')
        expect(announced[0].health).toBe('expired')
    })

    it('waits for a second miss before calling a cluster unreachable', () => {
        monitor.failed('prod', refused(0))
        expect(monitor.healthOf('prod')).toBe('healthy')

        monitor.failed('prod', refused(0))
        expect(monitor.healthOf('prod')).toBe('unreachable')
    })

    it('reads a refusal as the cluster answering, so it stays healthy', () => {
        failTwice('prod', refused(403))

        expect(monitor.healthOf('prod')).toBe('healthy')
        expect(announced).toEqual([])
    })

    it('forgets a lone miss once a request gets through', () => {
        monitor.failed('prod', refused(0))
        monitor.succeeded('prod')
        monitor.failed('prod', refused(0))

        expect(monitor.healthOf('prod')).toBe('healthy')
    })

    it('recovers when the cluster answers again', () => {
        failTwice('prod', refused(0))
        monitor.succeeded('prod')

        expect(monitor.healthOf('prod')).toBe('healthy')
        expect(announced.map(e => e.health)).toEqual(['unreachable', 'healthy'])
    })

    it('announces a change once however many requests report it', () => {
        for (let i = 0; i < 20; i++) {
            monitor.failed('prod', refused(0))
        }

        expect(announced).toHaveLength(1)
    })

    it('keeps the trouble of one cluster off another', () => {
        failTwice('prod', refused(0))

        expect(monitor.healthOf('prod')).toBe('unreachable')
        expect(monitor.healthOf('staging')).toBe('healthy')
    })

    it('carries what went wrong as the detail', () => {
        monitor.failed('prod', refused(401, 'The cluster rejected the credentials.'))

        expect(monitor.detailOf('prod')).toBe('The cluster rejected the credentials.')
    })

    it('forgets a cluster that went away', () => {
        failTwice('prod', refused(0))
        monitor.forget('prod')

        expect(monitor.healthOf('prod')).toBe('healthy')
        expect(monitor.detailOf('prod')).toBe('')
    })

    it('calls a slow cluster unstable and a silent one unreachable', () => {
        failTwice('slow', new ApiError('The cluster did not answer in time.', 'context deadline exceeded', 0))
        failTwice('gone', new ApiError('Could not reach the cluster', 'dial tcp: connection refused', 0))

        expect(monitor.healthOf('slow')).toBe('degraded')
        expect(monitor.healthOf('gone')).toBe('unreachable')
    })

    it('hands out a probe that reports for one cluster only', () => {
        const probe = monitor.probeFor('prod')

        probe.failed(refused(401))

        expect(monitor.healthOf('prod')).toBe('expired')
        expect(monitor.healthOf('staging')).toBe('healthy')

        probe.succeeded()
        expect(monitor.healthOf('prod')).toBe('healthy')
    })
})
