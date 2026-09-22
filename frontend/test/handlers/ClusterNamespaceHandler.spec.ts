import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = { available: {} as Record<string, string[]> }

    return {
        state,
        list: vi.fn(async (clusterId: string) => ({
            names: state.available[clusterId] ?? [],
            resourceVersion: 'rv-1',
        })),
        watch: vi.fn(async () => {}),
        unwatch: vi.fn(async () => {}),
    }
})

vi.mock('@/application/services/clusterNamespace/ClusterNamespaceService', () => ({
    ClusterNamespaceService: class {
        public list = fake.list

        public watch = fake.watch

        public unwatch = fake.unwatch
    },
}))

import { ClusterNamespaceHandler } from '@/application/handlers/cluster/ClusterNamespaceHandler'
import { NamespaceCreatedEvent } from '@/domain/events/cluster/NamespaceCreatedEvent'
import { ResourceCreatedEvent } from '@/domain/events/cluster/ResourceCreatedEvent'
import { ResourceDeletedEvent } from '@/domain/events/cluster/ResourceDeletedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'

container.resolve(ClusterNamespaceHandler)
const eventBus = container.resolve(EventBus)
const store = container.resolve(ClusterNamespaceStore)

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

describe('ClusterNamespaceHandler', () => {
    beforeEach(async () => {
        fake.state.available = { prod: ['default', 'payments'] }
        store.available = {}
        store.failures = {}
        store.loadingIds = []

        await store.loadFor('prod')
        vi.clearAllMocks()
    })

    it('reads the list again once a namespace is created', async () => {
        fake.state.available.prod = ['default', 'orders', 'payments']

        eventBus.emitEvent(new NamespaceCreatedEvent('prod', 'orders'))
        await settle()

        expect(store.availableOf('prod')).toEqual(['default', 'orders', 'payments'])
    })

    it('reads the list again for a namespace created from a manifest', async () => {
        fake.state.available.prod = ['default', 'orders', 'payments']

        eventBus.emitEvent(new ResourceCreatedEvent('prod', 'Namespace', 'orders', ''))
        await settle()

        expect(store.availableOf('prod')).toEqual(['default', 'orders', 'payments'])
    })

    it('drops a deleted namespace from the list', async () => {
        fake.state.available.prod = ['default']

        eventBus.emitEvent(new ResourceDeletedEvent('prod', 'Namespace', 'payments', ''))
        await settle()

        expect(store.availableOf('prod')).toEqual(['default'])
    })

    it('leaves the list alone for any other kind', async () => {
        eventBus.emitEvent(new ResourceDeletedEvent('prod', 'Pod', 'api-7f4', 'payments'))
        eventBus.emitEvent(new ResourceCreatedEvent('prod', 'Pod', 'api-8a1', 'payments'))
        await settle()

        expect(fake.list).not.toHaveBeenCalled()
    })

    it('asks nothing of a cluster whose list nobody has read', async () => {
        eventBus.emitEvent(new ResourceDeletedEvent('lab', 'Namespace', 'sandbox', ''))
        await settle()

        expect(fake.list).not.toHaveBeenCalled()
        expect(store.availableOf('lab')).toEqual([])
    })
})
