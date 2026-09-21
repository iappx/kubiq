import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = {
        overview: {
            workloads: [{ kindKey: '/v1/pods', title: 'Pods', icon: 'Box', slug: 'pods', section: 'workloads', total: 4, problems: 1, error: '' }],
            nodes: { total: 2, ready: 2, issues: [], error: '' },
            events: [],
            eventsError: '',
        },
        failure: undefined as Error | undefined,
    }

    return {
        state,
        load: vi.fn(async () => {
            if (state.failure) {
                throw state.failure
            }
            return state.overview
        }),
    }
})

vi.mock('@/application/services/clusterOverview/ClusterOverviewService', () => ({
    ClusterOverviewService: class {
        public load = fake.load
    },
}))

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { ClusterSessionHandler } from '@/application/handlers/cluster/ClusterSessionHandler'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { ClusterOverviewStore } from '@/store/modules/clusterOverview/ClusterOverviewStore'

container.resolve(ClusterSessionHandler)
const store = container.resolve(ClusterOverviewStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, (event) => {
    errors.push(event)
})

const request = (clusterId: string) => ({
    clusterId,
    kinds: [KubeResourceRegistry.find('', 'pods')!],
    namespaces: [] as string[],
})

describe('ClusterOverviewStore', () => {
    beforeEach(() => {
        errors.length = 0
        fake.state.failure = undefined
        vi.clearAllMocks()

        store.overviews = {}
    })

    it('starts empty and not loaded', () => {
        expect(store.stateOf('prod')).toMatchObject({ loading: false, loaded: false, error: '' })
        expect(store.stateOf('prod').overview.workloads).toEqual([])
    })

    it('holds what the service answered', async () => {
        await store.load(request('prod'))

        expect(store.stateOf('prod').loaded).toBe(true)
        expect(store.stateOf('prod').overview.workloads).toHaveLength(1)
        expect(store.stateOf('prod').overview.nodes.ready).toBe(2)
    })

    it('keeps one overview per cluster', async () => {
        await store.load(request('prod'))

        expect(store.stateOf('lab').loaded).toBe(false)
    })

    it('keeps the page on screen while it refreshes', async () => {
        await store.load(request('prod'))

        const pending = store.load(request('prod'))
        expect(store.stateOf('prod').overview.workloads).toHaveLength(1)
        expect(store.stateOf('prod').loading).toBe(true)

        await pending
    })

    it('reports a failure and releases the loading flag', async () => {
        fake.state.failure = new ApiError('Could not reach the cluster', 'timeout')

        await store.load(request('prod'))

        expect(store.stateOf('prod')).toMatchObject({ loading: false, error: 'Could not reach the cluster' })
        expect(errors).toHaveLength(1)
    })

    it('forgets the overview of a cluster that disconnects', async () => {
        await store.load(request('prod'))
        await store.load(request('lab'))

        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 0))

        expect(store.stateOf('prod').loaded).toBe(false)
        expect(store.stateOf('lab').loaded).toBe(true)
    })
})
