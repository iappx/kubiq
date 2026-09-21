import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

type TFakeSnapshot = {
    state: string
    usage: Record<string, { cpuCores: number; memoryBytes: number }>
    readAt: number
}

const fake = vi.hoisted(() => {
    const state = {
        nodes: {
            state: 'ready',
            usage: { 'worker-1': { cpuCores: 0.5, memoryBytes: 1024 } },
            readAt: 1,
        } as TFakeSnapshot,
        pods: {
            state: 'ready',
            usage: { 'prod/api-1': { cpuCores: 0.1, memoryBytes: 512 } },
            readAt: 1,
        } as TFakeSnapshot,
        failure: undefined as Error | undefined,
    }

    return {
        state,
        nodeUsage: vi.fn(async () => {
            if (state.failure) {
                throw state.failure
            }
            return state.nodes
        }),
        podUsage: vi.fn(async () => {
            if (state.failure) {
                throw state.failure
            }
            return state.pods
        }),
    }
})

vi.mock('@/application/services/metrics/MetricsService', () => ({
    MetricsService: class {
        public nodeUsage = fake.nodeUsage

        public podUsage = fake.podUsage
    },
}))

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { ClusterSessionHandler } from '@/application/handlers/cluster/ClusterSessionHandler'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterMetricsStore } from '@/store/modules/clusterMetrics/ClusterMetricsStore'

container.resolve(ClusterSessionHandler)
const store = container.resolve(ClusterMetricsStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, (event) => {
    errors.push(event)
})

describe('ClusterMetricsStore', () => {
    beforeEach(() => {
        errors.length = 0
        fake.state.failure = undefined
        store.clusters = {}
        vi.clearAllMocks()
    })

    it('answers an empty state for a cluster it has never read', () => {
        const state = store.stateOf('prod')

        expect(state.loaded).toBe(false)
        expect(state.nodes.state).toBe('missing')
        expect(store.nodeUsage('prod', 'worker-1')).toBeNull()
    })

    it('reads nodes and pods in one pass and keys them the way the tables ask', async () => {
        await store.load('prod', ['prod'])

        expect(store.stateOf('prod').loaded).toBe(true)
        expect(store.nodeUsage('prod', 'worker-1')?.cpuCores).toBe(0.5)
        expect(store.podUsage('prod', 'prod', 'api-1')?.memoryBytes).toBe(512)
        expect(fake.podUsage).toHaveBeenCalledWith('prod', ['prod'])
    })

    it('keeps one cluster apart from another', async () => {
        await store.load('prod', [])
        await store.load('lab', [])

        expect(Object.keys(store.clusters).sort()).toEqual(['lab', 'prod'])
    })

    // A metrics figure is decoration on a working table, so a failure to read one
    // travels as an event and leaves the table alone.
    it('reports a failure on the bus instead of throwing at the caller', async () => {
        fake.state.failure = new Error('boom')

        await expect(store.load('prod', [])).resolves.toBeUndefined()

        expect(errors).toHaveLength(1)
        expect(store.stateOf('prod').loading).toBe(false)
    })

    it('summarises availability from whichever half answered', async () => {
        fake.state.nodes = { state: 'missing', usage: {}, readAt: 1 }
        fake.state.pods = { state: 'forbidden', usage: {}, readAt: 1 }

        await store.load('prod', [])

        expect(store.usageState('prod')).toBe('forbidden')

        fake.state.nodes = { state: 'ready', usage: {}, readAt: 1 }
        await store.load('prod', [])

        expect(store.usageState('prod')).toBe('ready')
    })

    it('asks for nothing without a cluster', async () => {
        await store.load('', [])

        expect(fake.nodeUsage).not.toHaveBeenCalled()
    })

    it('forgets a cluster when its session closes', async () => {
        await store.load('prod', [])

        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 0))

        expect(store.stateOf('prod').loaded).toBe(false)
    })
})
