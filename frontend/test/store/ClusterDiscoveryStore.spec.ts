import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = {
        kinds: {} as Record<string, unknown[]>,
        failFor: {} as Record<string, Error>,
    }

    return {
        state,
        listKinds: vi.fn(async (clusterId: string) => {
            const failure = state.failFor[clusterId]
            if (failure) {
                throw failure
            }
            return state.kinds[clusterId] ?? []
        }),
    }
})

vi.mock('@/application/services/clusterDiscovery/ClusterDiscoveryService', () => ({
    ClusterDiscoveryService: class {
        public listKinds = fake.listKinds
    },
}))

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { ClusterSessionHandler } from '@/application/handlers/cluster/ClusterSessionHandler'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'

container.resolve(ClusterSessionHandler)
const store = container.resolve(ClusterDiscoveryStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, (event) => {
    errors.push(event)
})

const pods = KubeResourceRegistry.find('', 'pods')!
const deployments = KubeResourceRegistry.find('apps', 'deployments')!

describe('ClusterDiscoveryStore', () => {
    beforeEach(() => {
        errors.length = 0
        fake.state.kinds = { prod: [pods, deployments], lab: [pods] }
        fake.state.failFor = {}
        vi.clearAllMocks()

        store.kinds = {}
        store.loadingIds = []
        store.failures = {}
    })

    it('holds what the cluster reported', async () => {
        await store.loadOnce('prod')

        expect(store.kindsOf('prod').map(kind => kind.title)).toEqual(['Pods', 'Deployments'])
    })

    it('keeps one cluster out of another', async () => {
        await store.loadOnce('prod')
        await store.loadOnce('lab')

        expect(store.kindsOf('prod')).toHaveLength(2)
        expect(store.kindsOf('lab')).toHaveLength(1)
    })

    it('asks the cluster once', async () => {
        await store.loadOnce('prod')
        await store.loadOnce('prod')

        expect(fake.listKinds).toHaveBeenCalledTimes(1)
    })

    it('asks again when told to reload', async () => {
        await store.loadOnce('prod')
        await store.reload('prod')

        expect(fake.listKinds).toHaveBeenCalledTimes(2)
    })

    it('ignores a second load while the first is in flight', async () => {
        const pending = store.loadOnce('prod')
        await store.loadOnce('prod')
        await pending

        expect(fake.listKinds).toHaveBeenCalledTimes(1)
    })

    it('ignores an empty cluster id', async () => {
        await store.loadOnce('')

        expect(fake.listKinds).not.toHaveBeenCalled()
    })

    it('finds a kind by the slug the address bar carries', async () => {
        await store.loadOnce('prod')

        expect(store.findBySlug('prod', 'deployments.apps')?.kind).toBe('Deployment')
        expect(store.findBySlug('prod', 'widgets.acme.example.com')).toBeUndefined()
    })

    it('raises a failure instead of throwing, and keeps its text for the sidebar', async () => {
        fake.state.failFor.prod = new ApiError('The cluster denied access to this resource')

        await expect(store.reload('prod')).resolves.toBeUndefined()

        expect(errors).toHaveLength(1)
        expect(store.failureOf('prod')).toBe('The cluster denied access to this resource')
        expect(store.isLoading('prod')).toBe(false)
    })

    it('forgets the failure once the cluster answers', async () => {
        fake.state.failFor.prod = new ApiError('nope')
        await store.reload('prod')

        fake.state.failFor = {}
        await store.reload('prod')

        expect(store.failureOf('prod')).toBe('')
    })

    it('drops what it knew about a cluster that disconnects, and only that one', async () => {
        await store.loadOnce('prod')
        await store.loadOnce('lab')

        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 0))

        expect(store.kindsOf('prod')).toEqual([])
        expect(store.kindsOf('lab')).toHaveLength(1)
    })

    it('asks the cluster again after a reconnect', async () => {
        await store.loadOnce('prod')
        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 0))

        await store.loadOnce('prod')

        expect(fake.listKinds).toHaveBeenCalledTimes(2)
    })
})
