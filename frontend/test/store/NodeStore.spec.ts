import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = {
        pods: [] as unknown[],
        listFailure: undefined as Error | undefined,
        drainFailure: undefined as Error | undefined,
        drainResult: { evicted: 2, skipped: 1, failures: [] as unknown[] },
    }

    return {
        state,
        cordon: vi.fn(async () => undefined),
        uncordon: vi.fn(async () => undefined),
        podsOn: vi.fn(async () => {
            if (state.listFailure) {
                throw state.listFailure
            }
            return state.pods
        }),
        drain: vi.fn(async () => {
            if (state.drainFailure) {
                throw state.drainFailure
            }
            return state.drainResult
        }),
    }
})

vi.mock('@/application/services/node/NodeService', () => ({
    NodeService: class {
        public cordon = fake.cordon

        public uncordon = fake.uncordon

        public podsOn = fake.podsOn

        public drain = fake.drain
    },
}))

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { NodeDrainedEvent } from '@/domain/events/cluster/NodeDrainedEvent'
import { NodeSchedulingChangedEvent } from '@/domain/events/cluster/NodeSchedulingChangedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { PodEntity } from '@/domain/entities/workloads'
import { NodeStore } from '@/store/modules/node/NodeStore'

const store = container.resolve(NodeStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
const scheduling: NodeSchedulingChangedEvent[] = []
const drained: NodeDrainedEvent[] = []

eventBus.registerHandler(AppErrorEvent, event => void errors.push(event))
eventBus.registerHandler(NodeSchedulingChangedEvent, event => void scheduling.push(event))
eventBus.registerHandler(NodeDrainedEvent, event => void drained.push(event))

const nodes = KubeResourceRegistry.find('', 'nodes')!
const pods = KubeResourceRegistry.find('', 'pods')!

const target = { clusterId: 'prod', kind: nodes, name: 'worker-1', rowKey: 'worker-1-uid' }

const pod = (name: string) => PodEntity.build({
    uid: `${name}-uid`,
    metadata: { uid: `${name}-uid`, name, namespace: 'payments' },
    spec: { nodeName: 'worker-1' },
    status: { phase: 'Running' },
})

describe('NodeStore', () => {
    beforeEach(() => {
        errors.length = 0
        scheduling.length = 0
        drained.length = 0
        fake.state.pods = []
        fake.state.listFailure = undefined
        fake.state.drainFailure = undefined
        vi.clearAllMocks()
        store.pods = {}
        store.actingKeys = []
    })

    it('keeps the pods of a node under its own key', async () => {
        fake.state.pods = [pod('web')]

        await store.loadPods({ clusterId: 'prod', podsKind: pods, nodeName: 'worker-1' })

        expect(store.podsOf('prod', 'worker-1').pods.map(item => item.name)).toEqual(['web'])
        expect(store.podsOf('prod', 'worker-1').loaded).toBe(true)
        expect(store.podsOf('prod', 'other').pods).toEqual([])
    })

    it('shows a refusal as its own state and raises no error event', async () => {
        fake.state.listFailure = new ApiError('You cannot list pods', 'Forbidden', 403)

        await store.loadPods({ clusterId: 'prod', podsKind: pods, nodeName: 'worker-1' })

        expect(store.podsOf('prod', 'worker-1').forbidden).toBe(true)
        expect(store.podsOf('prod', 'worker-1').error).toBe('You cannot list pods')
        expect(errors).toHaveLength(0)
    })

    it('raises an error event for anything that is not a refusal', async () => {
        fake.state.listFailure = new ApiError('The cluster is unreachable', 'network', 0)

        await store.loadPods({ clusterId: 'prod', podsKind: pods, nodeName: 'worker-1' })

        expect(store.podsOf('prod', 'worker-1').forbidden).toBe(false)
        expect(errors).toHaveLength(1)
    })

    it('announces a cordon and an uncordon', async () => {
        expect(await store.cordon(target)).toBe(true)
        expect(await store.uncordon(target)).toBe(true)

        expect(fake.cordon).toHaveBeenCalledTimes(1)
        expect(fake.uncordon).toHaveBeenCalledTimes(1)
        expect(scheduling.map(event => event.cordoned)).toEqual([true, false])
    })

    it('reports a failed cordon as an error event, not as a throw', async () => {
        fake.cordon.mockRejectedValueOnce(new ApiError('refused', 'refused', 403))

        expect(await store.cordon(target)).toBe(false)
        expect(errors).toHaveLength(1)
        expect(scheduling).toHaveLength(0)
    })

    it('announces what the drain actually managed', async () => {
        fake.state.drainResult = { evicted: 2, skipped: 1, failures: [{ name: 'api', namespace: 'x', message: 'no' }] }

        expect(await store.drain({ target, podsKind: pods })).toBe(true)
        expect(drained[0]).toMatchObject({ name: 'worker-1', evicted: 2, skipped: 1, failed: 1 })
        expect(store.busyRowKeys('prod')).toEqual([])
    })

    it('marks the row busy for as long as an action runs, and only in its own cluster', async () => {
        let seen: string[] = []
        fake.drain.mockImplementationOnce(async () => {
            seen = [...store.busyRowKeys('prod'), ...store.busyRowKeys('staging')]
            return fake.state.drainResult
        })

        await store.drain({ target, podsKind: pods })

        expect(seen).toEqual(['worker-1-uid'])
        expect(store.busyRowKeys('prod')).toEqual([])
    })

    it('clears the busy mark when the action fails', async () => {
        fake.cordon.mockRejectedValueOnce(new ApiError('refused', 'refused', 403))

        await store.cordon(target)

        expect(store.busyRowKeys('prod')).toEqual([])
    })

    it('clears a disconnected cluster and leaves the others', async () => {
        fake.state.pods = [pod('web')]
        await store.loadPods({ clusterId: 'prod', podsKind: pods, nodeName: 'worker-1' })
        await store.loadPods({ clusterId: 'staging', podsKind: pods, nodeName: 'worker-1' })

        store.forget('prod')

        expect(store.podsOf('prod', 'worker-1').loaded).toBe(false)
        expect(store.podsOf('staging', 'worker-1').loaded).toBe(true)
    })
})
