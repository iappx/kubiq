import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResourceEventLog } from '@/application/services/resourceEvents/models/ResourceEventLog'
import { ResourceEventSelector } from '@/application/services/resourceEvents/models/ResourceEventSelector'
import { ResourceEventsService } from '@/application/services/resourceEvents/ResourceEventsService'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import { ResourceWatchService } from '@/application/services/resourceWatch/ResourceWatchService'
import type { TResourceChange } from '@/application/services/resourceWatch/types/TResourceChange'
import { EventEntity } from '@/domain/entities/cluster'
import { KubeResourceRegistry } from '@/domain/models/kube'

const pods = KubeResourceRegistry.find('', 'pods')!
const events = KubeResourceRegistry.find('', 'events')!

const request = {
    clusterId: 'prod',
    kind: pods,
    name: 'api-0',
    namespace: 'payments',
    uid: 'p-1',
    served: [pods, events],
}

const eventOf = (name: string, lastTimestamp: string, message = '') => EventEntity.build({
    uid: name,
    metadata: { uid: name, name, namespace: 'payments' },
    type: 'Normal',
    reason: 'Scheduled',
    message,
    count: 1,
    lastTimestamp,
})

describe('ResourceEventSelector', () => {
    it('scopes by uid when the object has one', () => {
        expect(ResourceEventSelector.forObject(request)).toBe('involvedObject.uid=p-1')
    })

    it('falls back to kind and name when it does not', () => {
        expect(ResourceEventSelector.forObject({ ...request, uid: '' }))
            .toBe('involvedObject.kind=Pod,involvedObject.name=api-0')
    })
})

describe('ResourceEventLog', () => {
    it('puts the newest event first', () => {
        const log = ResourceEventLog.of([
            eventOf('older', '2026-09-21T10:00:00Z'),
            eventOf('newer', '2026-09-21T12:00:00Z'),
        ])

        expect(log.map(event => event.name)).toEqual(['newer', 'older'])
    })

    it('ignores anything that is not an event', () => {
        expect(ResourceEventLog.of([{ name: 'not-an-event' } as never])).toEqual([])
    })

    it('replaces an event the watch reported again rather than listing it twice', () => {
        const current = ResourceEventLog.of([eventOf('a', '2026-09-21T10:00:00Z', 'first')])
        const changes: TResourceChange[] = [{
            type: 'modified',
            key: 'a',
            entity: eventOf('a', '2026-09-21T11:00:00Z', 'second'),
        }]

        const merged = ResourceEventLog.apply(current, changes)

        expect(merged).toHaveLength(1)
        expect(merged[0].message).toBe('second')
    })

    it('drops an event the watch deleted', () => {
        const current = ResourceEventLog.of([eventOf('a', '2026-09-21T10:00:00Z')])

        expect(ResourceEventLog.apply(current, [{ type: 'deleted', key: 'a', entity: current[0] }])).toEqual([])
    })

    it('keeps the order after a live addition', () => {
        const current = ResourceEventLog.of([eventOf('a', '2026-09-21T10:00:00Z')])
        const merged = ResourceEventLog.apply(current, [{
            type: 'added',
            key: 'b',
            entity: eventOf('b', '2026-09-21T12:00:00Z'),
        }])

        expect(merged.map(event => event.name)).toEqual(['b', 'a'])
    })
})

describe('ResourceEventsService', () => {
    const listService = { list: vi.fn(async () => ({ items: [], cursors: [{ namespace: 'payments', resourceVersion: '17' }] })) }
    const watchService = { start: vi.fn(async () => undefined), stop: vi.fn(async () => undefined) }

    let service: ResourceEventsService

    beforeEach(() => {
        listService.list.mockClear()
        watchService.start.mockClear()
        watchService.stop.mockClear()
        service = new ResourceEventsService(
            listService as unknown as ResourceListService,
            watchService as unknown as ResourceWatchService,
        )
    })

    it('lists the events of one object through the shared list service', async () => {
        await service.list(request)

        expect(listService.list).toHaveBeenCalledWith(expect.objectContaining({
            fieldSelector: 'involvedObject.uid=p-1',
            namespaces: ['payments'],
        }))
    })

    it('watches under a scope of its own so an Events list is not disturbed', async () => {
        await service.watch(request, [{ namespace: 'payments', resourceVersion: '17' }], {
            onChanges: () => undefined,
            onResync: () => undefined,
            onStale: () => undefined,
        })

        expect(watchService.start).toHaveBeenCalledWith(
            expect.objectContaining({ scope: 'p-1' }),
            expect.anything(),
        )
    })

    it('stops the session it started, under the same scope', async () => {
        await service.stop(request)

        expect(watchService.stop).toHaveBeenCalledWith('prod', events, 'p-1')
    })

    it('does not watch without a cursor to carry on from', async () => {
        expect(await service.watch(request, [], {
            onChanges: () => undefined,
            onResync: () => undefined,
            onStale: () => undefined,
        })).toBe(false)
        expect(watchService.start).not.toHaveBeenCalled()
    })
})

describe('ResourceWatchService.keyOf', () => {
    it('keeps the key of an unscoped watch exactly as it was', () => {
        expect(ResourceWatchService.keyOf('prod', pods)).toBe(`prod|${pods.key}`)
    })

    it('gives a scoped watch a session of its own', () => {
        expect(ResourceWatchService.keyOf('prod', events, 'p-1')).toBe(`prod|${events.key}|p-1`)
    })
})
