import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

import type { TResourceChange } from '@/application/services/resourceWatch/types/TResourceChange'
import type { TResourceWatchHandlers } from '@/application/services/resourceWatch/types/TResourceWatchHandlers'

const fake = vi.hoisted(() => {
    const state = {
        available: {} as Record<string, string[]>,
        version: 'rv-1',
        failFor: {} as Record<string, Error>,
        watchRefused: false,
        watching: {} as Record<string, TResourceWatchHandlers>,
    }

    return {
        state,
        list: vi.fn(async (clusterId: string) => {
            const failure = state.failFor[clusterId]
            if (failure) {
                throw failure
            }
            return { names: state.available[clusterId] ?? [], resourceVersion: state.version }
        }),
        watch: vi.fn(async (clusterId: string, _resourceVersion: string, handlers: TResourceWatchHandlers) => {
            if (state.watchRefused) {
                throw new Error('the cluster refused the stream')
            }
            state.watching[clusterId] = handlers
        }),
        unwatch: vi.fn(async (clusterId: string) => {
            delete state.watching[clusterId]
        }),
    }
})

vi.mock('@/application/services/clusterNamespace/ClusterNamespaceService', () => ({
    ClusterNamespaceService: class {
        public list = fake.list

        public watch = fake.watch

        public unwatch = fake.unwatch
    },
}))

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { ClusterSessionHandler } from '@/application/handlers/cluster/ClusterSessionHandler'
import { NamespaceEntity } from '@/domain/entities/cluster/NamespaceEntity'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'

const change = (type: TResourceChange['type'], name: string, phase: string = 'Active'): TResourceChange => ({
    type,
    key: name,
    entity: NamespaceEntity.build({
        uid: `uid-${name}`,
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: { name },
        status: { phase },
    }),
})

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

// Handlers subscribe in their constructor, so this one is resolved once.
container.resolve(ClusterSessionHandler)
const store = container.resolve(ClusterNamespaceStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, (event) => {
    errors.push(event)
})

describe('ClusterNamespaceStore', () => {
    beforeEach(() => {
        errors.length = 0
        fake.state.available = { prod: ['default', 'payments'], lab: ['sandbox'] }
        fake.state.version = 'rv-1'
        fake.state.failFor = {}
        fake.state.watchRefused = false
        fake.state.watching = {}
        vi.clearAllMocks()

        store.available = {}
        store.failures = {}
        store.loadingIds = []
    })

    it('loads the namespaces a cluster serves', async () => {
        await store.loadFor('prod')

        expect(store.availableOf('prod')).toEqual(['default', 'payments'])
        expect(store.isLoading('prod')).toBe(false)
    })

    it('keeps one cluster out of another', async () => {
        await store.loadFor('prod')
        await store.loadFor('lab')

        expect(store.availableOf('prod')).toEqual(['default', 'payments'])
        expect(store.availableOf('lab')).toEqual(['sandbox'])
    })

    it('asks the cluster once', async () => {
        await store.loadFor('prod')
        await store.loadFor('prod')

        expect(fake.list).toHaveBeenCalledTimes(1)
    })

    it('ignores a second load while the first is in flight', async () => {
        const pending = store.loadFor('prod')
        expect(store.isLoading('prod')).toBe(true)

        await store.loadFor('prod')
        await pending

        expect(fake.list).toHaveBeenCalledTimes(1)
    })

    it('ignores an empty cluster id', async () => {
        await store.loadFor('')

        expect(fake.list).not.toHaveBeenCalled()
    })

    it('is empty for a cluster nobody asked about', () => {
        expect(store.availableOf('ghost')).toEqual([])
    })

    it('raises a failure instead of throwing, and releases the flag', async () => {
        fake.state.failFor.prod = new ApiError('The cluster denied access to this resource')

        await expect(store.loadFor('prod')).resolves.toBeUndefined()

        expect(errors).toHaveLength(1)
        expect(store.isLoading('prod')).toBe(false)
    })

    it('drops what it cached for a cluster that disconnects, and only that one', async () => {
        await store.loadFor('prod')
        await store.loadFor('lab')

        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 0))

        expect(store.availableOf('prod')).toEqual([])
        expect(store.availableOf('lab')).toEqual(['sandbox'])
    })

    it('asks the cluster again after a reconnect', async () => {
        await store.loadFor('prod')
        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 0))

        await store.loadFor('prod')

        expect(fake.list).toHaveBeenCalledTimes(2)
    })

    it('reads the list again on demand, so a namespace that came or went shows up', async () => {
        await store.loadFor('prod')
        fake.state.available.prod = ['default', 'orders']

        await store.refresh('prod')

        expect(store.availableOf('prod')).toEqual(['default', 'orders'])
        expect(fake.list).toHaveBeenCalledTimes(2)
    })

    it('refreshes nothing for a cluster nobody asked about', async () => {
        await store.refresh('prod')

        expect(fake.list).not.toHaveBeenCalled()
        expect(store.availableOf('prod')).toEqual([])
    })

    it('ignores a refresh while a read is already in flight', async () => {
        await store.loadFor('prod')

        const pending = store.refresh('prod')
        await store.refresh('prod')
        await pending

        expect(fake.list).toHaveBeenCalledTimes(2)
    })

    it('keeps the list it has when the refresh fails, and says so', async () => {
        await store.loadFor('prod')
        fake.state.failFor.prod = new ApiError('The cluster denied access to this resource', 'Forbidden', 403)

        await store.refresh('prod')

        expect(store.availableOf('prod')).toEqual(['default', 'payments'])
        expect(store.isForbidden('prod')).toBe(true)
        expect(errors).toHaveLength(1)
    })

    it('watches the cluster it just read, resuming from the version the list was read at', async () => {
        await store.loadFor('prod')

        expect(fake.watch).toHaveBeenCalledTimes(1)
        expect(fake.watch.mock.calls[0][0]).toBe('prod')
        expect(fake.watch.mock.calls[0][1]).toBe('rv-1')
    })

    it('adds a namespace the stream reports, wherever it belongs in the order', async () => {
        await store.loadFor('prod')

        fake.state.watching.prod.onChanges([change('added', 'orders')])

        expect(store.availableOf('prod')).toEqual(['default', 'orders', 'payments'])
    })

    it('drops a namespace the stream reports as gone', async () => {
        await store.loadFor('prod')

        fake.state.watching.prod.onChanges([change('deleted', 'payments')])

        expect(store.availableOf('prod')).toEqual(['default'])
    })

    it('drops a namespace the moment it starts terminating, like the list would', async () => {
        await store.loadFor('prod')

        fake.state.watching.prod.onChanges([change('modified', 'payments', 'Terminating')])

        expect(store.availableOf('prod')).toEqual(['default'])
    })

    it('leaves the list as it was when the stream says nothing new', async () => {
        await store.loadFor('prod')
        const unchanged = store.available

        fake.state.watching.prod.onChanges([change('modified', 'payments')])

        expect(store.available).toBe(unchanged)
    })

    it('reads the list and watches again once the stream expires', async () => {
        await store.loadFor('prod')
        fake.state.available.prod = ['default', 'orders']

        fake.state.watching.prod.onResync()
        await settle()

        expect(store.availableOf('prod')).toEqual(['default', 'orders'])
        expect(fake.unwatch).toHaveBeenCalledWith('prod')
        expect(fake.watch).toHaveBeenCalledTimes(2)
    })

    it('reads the list once more when the stream is given up as stale', async () => {
        await store.loadFor('prod')
        fake.state.available.prod = ['default']

        fake.state.watching.prod.onStale(Date.now())
        await settle()

        expect(store.availableOf('prod')).toEqual(['default'])
        expect(fake.list).toHaveBeenCalledTimes(2)
    })

    it('keeps the list a cluster that refuses the stream still hands out', async () => {
        fake.state.watchRefused = true

        await store.loadFor('prod')

        expect(store.availableOf('prod')).toEqual(['default', 'payments'])
        expect(errors).toEqual([])
    })

    it('stops watching a cluster that disconnects', async () => {
        await store.loadFor('prod')

        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 0))

        expect(fake.unwatch).toHaveBeenCalledWith('prod')
    })

    it('forgetting a cluster it never cached changes nothing', () => {
        store.forget('ghost')

        expect(store.available).toEqual({})
    })

    it('remembers that the cluster refused the list, so the picker can say why it is empty', async () => {
        fake.state.failFor.prod = new ApiError('The cluster denied access to this resource', 'Forbidden', 403)

        await store.loadFor('prod')

        expect(store.isForbidden('prod')).toBe(true)
        expect(store.failureOf('prod')).toBe('forbidden')
    })

    it('tells a refusal apart from a cluster it could not reach', async () => {
        fake.state.failFor.prod = new ApiError('Could not reach the cluster', 'connection refused', 0)

        await store.loadFor('prod')

        expect(store.isForbidden('prod')).toBe(false)
        expect(store.failureOf('prod')).toBe('unreachable')
    })

    it('claims no failure for a cluster that answered', async () => {
        await store.loadFor('prod')

        expect(store.failureOf('prod')).toBeNull()
    })

    it('clears the refusal once the cluster answers', async () => {
        fake.state.failFor.prod = new ApiError('denied', 'Forbidden', 403)
        await store.loadFor('prod')

        delete fake.state.failFor.prod
        await store.loadFor('prod')

        expect(store.isForbidden('prod')).toBe(false)
    })

    it('drops the refusal with the cluster it belonged to', async () => {
        fake.state.failFor.prod = new ApiError('denied', 'Forbidden', 403)
        await store.loadFor('prod')

        store.forget('prod')

        expect(store.failureOf('prod')).toBeNull()
    })
})
