import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import { ResourceWatchService } from '@/application/services/resourceWatch/ResourceWatchService'
import { ResourceWatchLimits } from '@/application/services/resourceWatch/constants/ResourceWatchLimits'
import type { TResourceChange } from '@/application/services/resourceWatch/types/TResourceChange'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'
import { MemoryWatchTransport } from '../../support/MemoryWatchTransport'

const transport = new MemoryKubeTransport()
const stream = new MemoryWatchTransport()
const released: string[] = []

const pods = KubeResourceRegistry.find('', 'pods')!

const connectionService = {
    context: () => EntityRepo.create().use(KubeEntityContext, transport as never).getContext(KubeEntityContext),
    stream: () => stream,
    registerStream: (clusterId: string) => () => released.push(clusterId),
} as unknown as ClusterConnectionService

let service: ResourceWatchService
let changes: TResourceChange[][]
let resyncs: number
let staleAt: number[]

const handlers = () => ({
    onChanges: (batch: readonly TResourceChange[]) => changes.push([...batch]),
    onResync: () => {
        resyncs++
    },
    onStale: (at: number) => staleAt.push(at),
})

const flush = () => vi.advanceTimersByTime(ResourceWatchLimits.flushIntervalMs)

describe('ResourceWatchService', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        transport.reset()
        stream.reset()
        released.length = 0
        changes = []
        resyncs = 0
        staleAt = []
        service = new ResourceWatchService(new ResourceListService(connectionService))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('opens one stream per namespace scope, each from its own cursor', async () => {
        await service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [
                { namespace: 'payments', resourceVersion: '11' },
                { namespace: 'ledger', resourceVersion: '22' },
            ],
        }, handlers())

        expect(stream.requests.map(request => request.path)).toEqual([
            '/api/v1/namespaces/payments/pods',
            '/api/v1/namespaces/ledger/pods',
        ])
        expect(stream.requests.map(request => request.resourceVersion)).toEqual(['11', '22'])
    })

    it('watches every namespace at once when nothing is scoped', async () => {
        await service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '7' }],
        }, handlers())

        expect(stream.lastRequest.path).toBe('/api/v1/pods')
    })

    it('puts a label selector in the watch request', async () => {
        await service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '7' }],
            labelSelector: 'app=api',
        }, handlers())

        expect(stream.lastRequest.labelSelector).toBe('app=api')
    })

    it('turns added, modified and deleted into changes carrying entities', async () => {
        await service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '1' }],
        }, handlers())

        stream.last.object('added', 'api-0')
        stream.last.object('modified', 'api-1')
        stream.last.object('deleted', 'api-2')
        flush()

        expect(changes).toHaveLength(1)
        expect(changes[0].map(change => change.type)).toEqual(['added', 'modified', 'deleted'])
        expect(changes[0].map(change => change.key)).toEqual(['api-0', 'api-1', 'api-2'])
        expect(changes[0][0].entity).toMatchObject({ name: 'api-0', namespace: 'payments' })
    })

    it('delivers every event of a burst in a single batch', async () => {
        await service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '1' }],
        }, handlers())

        for (let i = 0; i < 40; i++) {
            stream.last.object('modified', `api-${i}`)
        }
        flush()

        expect(changes).toHaveLength(1)
        expect(changes[0]).toHaveLength(40)
    })

    it('writes nothing until the flush interval passes', async () => {
        await service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '1' }],
        }, handlers())

        stream.last.object('added', 'api-0')
        vi.advanceTimersByTime(ResourceWatchLimits.flushIntervalMs - 1)
        expect(changes).toEqual([])

        vi.advanceTimersByTime(1)
        expect(changes).toHaveLength(1)
    })

    it('asks for a resync when the cursor expired', async () => {
        await service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '1' }],
        }, handlers())

        stream.last.emit({ type: 'expired', message: 'too old' })

        expect(resyncs).toBe(1)
        expect(staleAt).toEqual([])
    })

    it('asks for a resync rather than replaying a buffer that outgrew the list', async () => {
        await service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '1' }],
        }, handlers())

        for (let i = 0; i <= ResourceWatchLimits.maxPendingChanges; i++) {
            stream.last.object('modified', `api-${i}`)
        }

        expect(resyncs).toBe(1)
    })

    it('reports a dropped watch as stale', async () => {
        await service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '1' }],
        }, handlers())

        stream.last.close('error')

        expect(staleAt).toHaveLength(1)
        expect(staleAt[0]).toBeGreaterThan(0)
    })

    it('resumes a stream the cluster closed, from the last version it saw', async () => {
        await service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '1' }],
        }, handlers())

        stream.last.object('modified', 'api-0', '99')
        vi.advanceTimersByTime(ResourceWatchLimits.minimumLifetimeMs + 1)
        stream.last.close('eof')
        await vi.runOnlyPendingTimersAsync()

        expect(stream.requests).toHaveLength(2)
        expect(stream.lastRequest.resourceVersion).toBe('99')
        expect(staleAt).toEqual([])
    })

    it('gives up on a stream that keeps dying at once and says the list is stale', async () => {
        await service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '1' }],
        }, handlers())

        for (let i = 0; i < ResourceWatchLimits.maxConsecutiveFlaps; i++) {
            stream.last.close('eof')
            await vi.runOnlyPendingTimersAsync()
        }

        expect(staleAt).toHaveLength(1)
    })

    it('treats a deliberate stop as neither stale nor a reason to reconnect', async () => {
        await service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '1' }],
        }, handlers())

        stream.last.close('stopped')
        await vi.runOnlyPendingTimersAsync()

        expect(stream.requests).toHaveLength(1)
        expect(staleAt).toEqual([])
    })

    it('stops the stream and releases it from the cluster registry', async () => {
        await service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '1' }],
        }, handlers())

        await service.stop('prod', pods)

        expect(stream.liveCount).toBe(0)
        expect(released).toEqual(['prod'])
        expect(service.isWatching('prod', pods)).toBe(false)
    })

    it('drops events that arrive after the watch was stopped', async () => {
        await service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '1' }],
        }, handlers())

        const subscription = stream.last
        await service.stop('prod', pods)
        subscription.emit({ type: 'added', object: { metadata: { uid: 'late', name: 'late' } } })
        flush()

        expect(changes).toEqual([])
    })

    it('replaces a watch of the same list instead of opening a second one', async () => {
        const request = { clusterId: 'prod', kind: pods, cursors: [{ namespace: '', resourceVersion: '1' }] }

        await service.start(request, handlers())
        await service.start(request, handlers())

        expect(stream.opened).toHaveLength(2)
        expect(stream.liveCount).toBe(1)
    })

    it('stops every watch of a cluster that went away', async () => {
        await service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '1' }],
        }, handlers())

        await service.release('prod')

        expect(stream.liveCount).toBe(0)
        expect(service.isWatching('prod', pods)).toBe(false)
    })

    it('reports a watch the cluster refused to open', async () => {
        stream.failure = new ApiError('Could not watch the cluster for changes')

        await expect(service.start({
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '1' }],
        }, handlers())).rejects.toThrow('Could not watch the cluster for changes')

        expect(service.isWatching('prod', pods)).toBe(false)
    })
})
