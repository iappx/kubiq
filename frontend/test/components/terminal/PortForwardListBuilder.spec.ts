import { describe, expect, it } from 'vitest'
import { PortForwardRecord } from '@/application/services/portForward/models/PortForwardRecord'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import { PortForwardListBuilder } from '@/components/terminal/PortForwardListBuilder'

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

describe('PortForwardListBuilder', () => {
    describe('groups', () => {
        it('groups the forwards of every cluster under that cluster, clusters in name order', () => {
            const groups = PortForwardListBuilder.groups([
                forward({ id: 'a', clusterId: 'stage' }),
                forward({ id: 'b', clusterId: 'prod' }),
                forward({ id: 'c', clusterId: 'stage', name: 'web' }),
            ])

            expect(groups.map(group => [group.title, group.rows.map(row => row.id)])).toEqual([
                ['prod', ['b']],
                ['stage', ['a', 'c']],
            ])
        })

        it('orders the rows of a cluster by namespace, name and port', () => {
            const [group] = PortForwardListBuilder.groups([
                forward({ id: 'late-port', remotePort: 9090 }),
                forward({ id: 'other-ns', namespace: 'billing' }),
                forward({ id: 'early-port', remotePort: 80 }),
                forward({ id: 'other-name', name: 'admin' }),
            ])

            expect(group.rows.map(row => row.id)).toEqual(['other-ns', 'other-name', 'early-port', 'late-port'])
        })

        it('has nothing to show when nothing is forwarded', () => {
            expect(PortForwardListBuilder.groups([])).toEqual([])
        })
    })

    describe('a row', () => {
        it('names the target and the local address of a running forward', () => {
            const row = PortForwardListBuilder.row(forward({ status: 'active', boundPort: 18080 }))

            expect(row.target).toBe('payments / svc / api:8080')
            expect(row.address).toBe('127.0.0.1:18080')
            expect(row.statusTitle).toBe('Active')
            expect(row.modeTitle).toBe('On connect')
            expect(row.modeHint).not.toBe('')
            expect(row.tone).toBe('ok')
            expect(row).toMatchObject({ isListening: true, canOpen: true, canCopy: true, canStop: true })
        })

        it('keeps the address of a stopped forward, but offers Start and no browser', () => {
            const row = PortForwardListBuilder.row(forward({ status: 'stopped', lastLocalPort: 18080 }))

            expect(row.address).toBe('127.0.0.1:18080')
            expect(row.tone).toBe('unknown')
            expect(row).toMatchObject({ isListening: false, canOpen: false, canCopy: true, canStop: false })
        })

        it('offers nothing to copy while a forward has never had a port', () => {
            const row = PortForwardListBuilder.row(forward({ status: 'stopped' }))

            expect(row.address).toBe('')
            expect(row.canCopy).toBe(false)
        })

        it('tells a forward waiting for its cluster apart from a stopped one, and lets it be stopped', () => {
            const row = PortForwardListBuilder.row(forward({ status: 'waiting', restoreMode: 'connectOnStart' }))

            expect(row.statusTitle).toBe('Waiting for cluster')
            expect(row.modeTitle).toBe('Connect on start')
            expect(row.tone).toBe('pending')
            expect(row.canStop).toBe(true)
        })

        it('shows the error of a failed forward and lets it be started again', () => {
            const row = PortForwardListBuilder.row(forward({ status: 'error', error: 'The pod is gone' }))

            expect(row.error).toBe('The pod is gone')
            expect(row.tone).toBe('error')
            expect(row.canStop).toBe(false)
        })

        it('shows why a forward is reconnecting', () => {
            const row = PortForwardListBuilder.row(forward({ status: 'reconnecting', boundPort: 18080, error: 'No running pod' }))

            expect(row.error).toBe('No running pod')
            expect(row.tone).toBe('warning')
            expect(row.canOpen).toBe(true)
        })

        it('does not carry a stale error into a healthy row', () => {
            expect(PortForwardListBuilder.row(forward({ status: 'active', error: 'old' })).error).toBe('')
        })

        it('leads to the object in its own cluster', () => {
            expect(PortForwardListBuilder.row(forward()).path)
                .toBe('/cluster/prod/network/services?ns=payments&name=api')
            expect(PortForwardListBuilder.row(forward({ clusterId: 'stage', resource: 'pods', name: 'api-0' })).path)
                .toBe('/cluster/stage/workloads/pods?ns=payments&name=api-0')
        })
    })

    describe('summary', () => {
        it('counts the active forwards among all of them', () => {
            expect(PortForwardListBuilder.summary([
                forward({ status: 'active' }),
                forward({ status: 'stopped' }),
                forward({ status: 'waiting' }),
            ])).toBe('1 of 3 active')
        })

        it('says how many need attention', () => {
            expect(PortForwardListBuilder.summary([forward({ status: 'error' })]))
                .toBe('0 of 1 active, 1 needs attention')
            expect(PortForwardListBuilder.summary([forward({ status: 'error' }), forward({ status: 'reconnecting' })]))
                .toBe('1 of 2 active, 2 need attention')
        })
    })
})
