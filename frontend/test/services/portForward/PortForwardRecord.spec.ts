import { describe, expect, it } from 'vitest'
import { PortForwardRecord } from '@/application/services/portForward/models/PortForwardRecord'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import { PortForwardEntity } from '@/domain/entities/portForward'

const forward = (overrides: Partial<TPortForward> = {}): TPortForward => ({
    id: 'pf-1',
    clusterId: 'prod',
    namespace: 'payments',
    resource: 'services',
    name: 'api',
    remotePort: 8080,
    localPort: 0,
    lastLocalPort: 0,
    restoreMode: 'onConnect',
    isStoppedByUser: false,
    createdAt: 1,
    label: 'svc/api:8080',
    ...PortForwardRecord.idle('stopped'),
    ...overrides,
})

describe('PortForwardRecord', () => {
    it('joins a saved forward with what it is doing now', () => {
        const entity = PortForwardEntity.build({
            id: 'pf-1', clusterId: 'prod', namespace: 'payments', resource: 'services', name: 'api',
            remotePort: '8080', localPort: 0, lastLocalPort: 40001, restoreMode: 'manual', createdAt: 7,
        })

        const joined = PortForwardRecord.of(entity, { status: 'active', error: '', boundPort: 40001, podName: 'api-7d5', targetPort: 9090 })

        expect(joined).toMatchObject({
            remotePort: 8080,
            restoreMode: 'manual',
            label: 'svc/api:8080',
            status: 'active',
            podName: 'api-7d5',
        })
    })

    it('rests a forward as its restore mode says', () => {
        expect(PortForwardRecord.restingStatus('manual', false)).toBe('stopped')
        expect(PortForwardRecord.restingStatus('onConnect', false)).toBe('waiting')
        expect(PortForwardRecord.restingStatus('connectOnStart', false)).toBe('waiting')
    })

    it('rests a forward the user stopped as stopped, whatever its mode', () => {
        expect(PortForwardRecord.restingStatus('onConnect', true)).toBe('stopped')
        expect(PortForwardRecord.restingStatus('connectOnStart', true)).toBe('stopped')
    })

    it('reads a forward saved before it could be stopped by the user as not stopped', () => {
        const entity = PortForwardEntity.build({
            id: 'pf-1', clusterId: 'prod', namespace: 'payments', resource: 'services', name: 'api',
            remotePort: 8080, localPort: 0, lastLocalPort: 0, restoreMode: 'onConnect', createdAt: 7,
        })

        expect(PortForwardRecord.of(entity, PortForwardRecord.idle('waiting')).isStoppedByUser).toBe(false)
    })

    it('shows the port it listens on, else the one it asked for, else the one it had', () => {
        expect(PortForwardRecord.addressOf(forward({ boundPort: 41000, localPort: 18080 }))).toBe('127.0.0.1:41000')
        expect(PortForwardRecord.addressOf(forward({ localPort: 18080, lastLocalPort: 40001 }))).toBe('127.0.0.1:18080')
        expect(PortForwardRecord.urlOf(forward({ lastLocalPort: 40001 }))).toBe('http://127.0.0.1:40001')
        expect(PortForwardRecord.addressOf(forward())).toBe('')
    })

    it('matches a target whatever way its port is written', () => {
        expect(PortForwardRecord.matches(forward(), 'prod', 'payments', 'services', 'api', '8080')).toBe(true)
        expect(PortForwardRecord.matches(forward(), 'prod', 'payments', 'pods', 'api', 8080)).toBe(false)
    })

    it('tells a change of port from a change of mode', () => {
        expect(PortForwardRecord.changesPorts(forward(), { localPort: 18080 })).toBe(true)
        expect(PortForwardRecord.changesPorts(forward(), { remotePort: '8080' })).toBe(false)
        expect(PortForwardRecord.changesPorts(forward(), { restoreMode: 'manual' })).toBe(false)
    })
})
