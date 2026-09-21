import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = {
        available: {} as Record<string, string[]>,
        failFor: {} as Record<string, Error>,
    }

    return {
        state,
        listAvailable: vi.fn(async (clusterId: string) => {
            const failure = state.failFor[clusterId]
            if (failure) {
                throw failure
            }
            return state.available[clusterId] ?? []
        }),
    }
})

vi.mock('@/application/services/clusterNamespace/ClusterNamespaceService', () => ({
    ClusterNamespaceService: class {
        public listAvailable = fake.listAvailable
    },
}))

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { ClusterSessionHandler } from '@/application/handlers/cluster/ClusterSessionHandler'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'

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
        fake.state.failFor = {}
        vi.clearAllMocks()

        store.available = {}
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

        expect(fake.listAvailable).toHaveBeenCalledTimes(1)
    })

    it('ignores a second load while the first is in flight', async () => {
        const pending = store.loadFor('prod')
        expect(store.isLoading('prod')).toBe(true)

        await store.loadFor('prod')
        await pending

        expect(fake.listAvailable).toHaveBeenCalledTimes(1)
    })

    it('ignores an empty cluster id', async () => {
        await store.loadFor('')

        expect(fake.listAvailable).not.toHaveBeenCalled()
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

        expect(fake.listAvailable).toHaveBeenCalledTimes(2)
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
