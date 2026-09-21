import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = {
        result: {
            items: [] as unknown[],
            total: undefined as number | undefined,
            cursors: [] as { namespace: string, resourceVersion: string }[],
        },
        listFailure: undefined as Error | undefined,
        deleteFailure: undefined as Error | undefined,
        watchFailure: undefined as Error | undefined,
        actionFailure: undefined as Error | undefined,
        handlers: undefined as any,
        started: [] as unknown[],
        stopped: 0,
        triggeredJob: 'nightly-report-x7k2p',
    }

    return {
        state,
        list: vi.fn(async () => {
            if (state.listFailure) {
                throw state.listFailure
            }
            return state.result
        }),
        remove: vi.fn(async () => {
            if (state.deleteFailure) {
                throw state.deleteFailure
            }
        }),
        startWatch: vi.fn(async (request: unknown, handlers: unknown) => {
            if (state.watchFailure) {
                throw state.watchFailure
            }
            state.started.push(request)
            state.handlers = handlers
        }),
        stopWatch: vi.fn(async () => {
            state.stopped++
        }),
        release: vi.fn(async () => undefined),
        scale: vi.fn(async () => {
            if (state.actionFailure) {
                throw state.actionFailure
            }
        }),
        restart: vi.fn(async () => {
            if (state.actionFailure) {
                throw state.actionFailure
            }
        }),
        trigger: vi.fn(async () => {
            if (state.actionFailure) {
                throw state.actionFailure
            }
            return state.triggeredJob
        }),
    }
})

vi.mock('@/application/services/resourceList/ResourceListService', () => ({
    ResourceListService: class {
        public list = fake.list
        public delete = fake.remove
    },
}))

vi.mock('@/application/services/resourceWatch/ResourceWatchService', () => ({
    ResourceWatchService: class {
        public start = fake.startWatch
        public stop = fake.stopWatch
        public release = fake.release
    },
}))

vi.mock('@/application/services/workloadAction/WorkloadActionService', () => ({
    WorkloadActionService: class {
        public scale = fake.scale
        public restart = fake.restart
        public trigger = fake.trigger
    },
}))

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { CronJobTriggeredEvent } from '@/domain/events/cluster/CronJobTriggeredEvent'
import { ResourceDeletedEvent } from '@/domain/events/cluster/ResourceDeletedEvent'
import { WorkloadRestartedEvent } from '@/domain/events/cluster/WorkloadRestartedEvent'
import { WorkloadScaledEvent } from '@/domain/events/cluster/WorkloadScaledEvent'
import { ClusterSessionHandler } from '@/application/handlers/cluster/ClusterSessionHandler'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { CronJobEntity } from '@/domain/entities/workloads'
import { CustomResourceEntity } from '@/domain/entities/kube'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { ClusterResourceStore } from '@/store/modules/clusterResource/ClusterResourceStore'

container.resolve(ClusterSessionHandler)
const store = container.resolve(ClusterResourceStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, (event) => {
    errors.push(event)
})

const announced: unknown[] = []
const record = (event: unknown): void => {
    announced.push(event)
}
eventBus.registerHandler(WorkloadScaledEvent, record)
eventBus.registerHandler(WorkloadRestartedEvent, record)
eventBus.registerHandler(CronJobTriggeredEvent, record)
eventBus.registerHandler(ResourceDeletedEvent, record)

const pods = KubeResourceRegistry.find('', 'pods')!
const nodes = KubeResourceRegistry.find('', 'nodes')!
const cronJobs = KubeResourceRegistry.find('batch', 'cronjobs')!
const jobs = KubeResourceRegistry.find('batch', 'jobs')!

const object = (name: string) => CustomResourceEntity.build({ uid: name, metadata: { uid: name, name } })

const target = (name: string, kind = pods) => ({
    clusterId: 'prod',
    kind,
    name,
    namespace: 'payments',
    rowKey: name,
})

const change = (type: 'added' | 'modified' | 'deleted', name: string) => ({
    type,
    key: name,
    entity: object(name),
})

const itemNames = (kind = pods) => store.stateOf('prod', kind).items.map(item => (item as any).name)

describe('ClusterResourceStore', () => {
    beforeEach(() => {
        errors.length = 0
        announced.length = 0
        fake.state.result = { items: [object('api-0')], total: 1, cursors: [{ namespace: '', resourceVersion: '10' }] }
        fake.state.listFailure = undefined
        fake.state.deleteFailure = undefined
        fake.state.watchFailure = undefined
        fake.state.actionFailure = undefined
        fake.state.started = []
        fake.state.stopped = 0
        fake.state.handlers = undefined
        vi.clearAllMocks()

        store.lists = {}
    })

    it('starts every list empty and not loaded', () => {
        expect(store.stateOf('prod', pods)).toMatchObject({ items: [], loading: false, loaded: false })
    })

    it('holds what the list answered, cursor included', async () => {
        await store.load({ clusterId: 'prod', kind: pods })

        expect(store.stateOf('prod', pods).items).toHaveLength(1)
        expect(store.stateOf('prod', pods).total).toBe(1)
        expect(store.stateOf('prod', pods).loaded).toBe(true)
        expect(store.stateOf('prod', pods).cursors).toEqual([{ namespace: '', resourceVersion: '10' }])
    })

    it('keys a list by cluster and kind, so no two screens share one', async () => {
        await store.load({ clusterId: 'prod', kind: pods })

        expect(store.stateOf('lab', pods).items).toEqual([])
        expect(store.stateOf('prod', nodes).items).toEqual([])
    })

    it('releases the loading flag even when the list fails', async () => {
        fake.state.listFailure = new ApiError('The cluster reported an internal error')

        await store.load({ clusterId: 'prod', kind: pods })

        expect(store.stateOf('prod', pods).loading).toBe(false)
        expect(store.stateOf('prod', pods).error).toBe('The cluster reported an internal error')
        expect(errors).toHaveLength(1)
    })

    it('marks a refused list as forbidden and raises nothing', async () => {
        fake.state.listFailure = new ApiError('The cluster denied access to this resource', 'Forbidden', 403)

        await store.load({ clusterId: 'prod', kind: pods })

        expect(store.stateOf('prod', pods).forbidden).toBe(true)
        expect(errors).toEqual([])
    })

    it('clears a previous failure when the list comes back', async () => {
        fake.state.listFailure = new ApiError('nope', '', 403)
        await store.load({ clusterId: 'prod', kind: pods })

        fake.state.listFailure = undefined
        await store.load({ clusterId: 'prod', kind: pods })

        expect(store.stateOf('prod', pods)).toMatchObject({ error: '', forbidden: false })
    })

    it('keeps the rows on screen while a reload is in flight', async () => {
        await store.load({ clusterId: 'prod', kind: pods })

        const pending = store.load({ clusterId: 'prod', kind: pods })
        expect(store.stateOf('prod', pods).items).toHaveLength(1)
        expect(store.stateOf('prod', pods).loading).toBe(true)

        await pending
    })

    it('takes items from outside a load', () => {
        store.setItems('prod', pods, [object('api-0'), object('api-1')], 2)

        expect(store.stateOf('prod', pods).items).toHaveLength(2)
        expect(store.stateOf('prod', pods).loaded).toBe(true)
    })

    it('drops every list of a cluster that disconnects, and only that cluster', async () => {
        await store.load({ clusterId: 'prod', kind: pods })
        await store.load({ clusterId: 'lab', kind: pods })

        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 0))

        expect(store.stateOf('prod', pods).items).toEqual([])
        expect(store.stateOf('lab', pods).items).toHaveLength(1)
        expect(fake.release).toHaveBeenCalledWith('prod')
    })

    it('has no state for a screen with no kind resolved yet', () => {
        expect(store.stateOf('prod', null).items).toEqual([])
    })
})

describe('ClusterResourceStore watch', () => {
    beforeEach(async () => {
        errors.length = 0
        fake.state.result = { items: [object('api-0')], total: 1, cursors: [{ namespace: '', resourceVersion: '10' }] }
        fake.state.listFailure = undefined
        fake.state.watchFailure = undefined
        fake.state.started = []
        fake.state.stopped = 0
        vi.clearAllMocks()
        store.lists = {}

        await store.load({ clusterId: 'prod', kind: pods })
    })

    it('starts the watch from the cursors the list came back with', async () => {
        await store.watch({ clusterId: 'prod', kind: pods, labelSelector: 'app=api' })

        expect(fake.state.started).toEqual([{
            clusterId: 'prod',
            kind: pods,
            cursors: [{ namespace: '', resourceVersion: '10' }],
            labelSelector: 'app=api',
            fieldSelector: undefined,
        }])
        expect(store.stateOf('prod', pods).watching).toBe(true)
    })

    it('does not watch a list that was never loaded', async () => {
        store.lists = {}

        await store.watch({ clusterId: 'prod', kind: pods })

        expect(fake.startWatch).not.toHaveBeenCalled()
    })

    it('says the list is stale when the watch cannot be opened, and reports why', async () => {
        fake.state.watchFailure = new ApiError('Could not watch the cluster for changes')

        await store.watch({ clusterId: 'prod', kind: pods })

        expect(store.stateOf('prod', pods).watching).toBe(false)
        expect(store.stateOf('prod', pods).staleSince).toBeGreaterThan(0)
        expect(errors).toHaveLength(1)
    })

    it('stops the watch and clears the live state', async () => {
        await store.watch({ clusterId: 'prod', kind: pods })
        await store.unwatch('prod', pods)

        expect(fake.state.stopped).toBe(1)
        expect(store.stateOf('prod', pods)).toMatchObject({ watching: false, staleSince: 0 })
    })

    it('adds a row the watch reported as added', async () => {
        store.applyChanges('prod', pods, [change('added', 'api-1')])

        expect(itemNames()).toEqual(['api-0', 'api-1'])
        expect(store.stateOf('prod', pods).total).toBe(2)
    })

    it('replaces a row in place when it changed', async () => {
        store.applyChanges('prod', pods, [change('modified', 'api-0')])

        expect(itemNames()).toEqual(['api-0'])
        expect(store.stateOf('prod', pods).total).toBe(1)
    })

    it('takes a row out when it was deleted', async () => {
        store.applyChanges('prod', pods, [change('deleted', 'api-0')])

        expect(itemNames()).toEqual([])
        expect(store.stateOf('prod', pods).total).toBe(0)
    })

    it('ignores a deletion of a row it never held', async () => {
        store.applyChanges('prod', pods, [change('deleted', 'ghost')])

        expect(itemNames()).toEqual(['api-0'])
        expect(store.stateOf('prod', pods).total).toBe(1)
    })

    it('applies a whole batch in one write', async () => {
        store.applyChanges('prod', pods, [
            change('added', 'api-1'),
            change('added', 'api-2'),
            change('deleted', 'api-0'),
            change('modified', 'api-2'),
        ])

        expect(itemNames()).toEqual(['api-1', 'api-2'])
        expect(store.stateOf('prod', pods).flashKeys).toEqual(['api-1', 'api-2', 'api-2'])
    })

    it('marks the rows a batch touched so the table can tint them once', async () => {
        store.applyChanges('prod', pods, [change('modified', 'api-0')])

        expect(store.stateOf('prod', pods).flashKeys).toEqual(['api-0'])
    })

    it('clears the tint on a relist', async () => {
        store.applyChanges('prod', pods, [change('modified', 'api-0')])

        await store.load({ clusterId: 'prod', kind: pods })

        expect(store.stateOf('prod', pods).flashKeys).toEqual([])
    })

    it('ignores a batch for a list that is gone', () => {
        store.lists = {}

        store.applyChanges('prod', pods, [change('added', 'api-1')])

        expect(store.stateOf('prod', pods).items).toEqual([])
    })

    it('relists and resubscribes when the watch reports the cursor expired', async () => {
        await store.watch({ clusterId: 'prod', kind: pods })
        vi.clearAllMocks()
        fake.state.started = []

        await store.refresh({ clusterId: 'prod', kind: pods })

        expect(fake.state.stopped).toBe(1)
        expect(fake.list).toHaveBeenCalledTimes(1)
        expect(fake.state.started).toHaveLength(1)
        expect(errors).toEqual([])
        expect(store.stateOf('prod', pods).watching).toBe(true)
    })
})

describe('ClusterResourceStore actions', () => {
    beforeEach(async () => {
        errors.length = 0
        announced.length = 0
        fake.state.result = { items: [object('api-0')], total: 1, cursors: [] }
        fake.state.listFailure = undefined
        fake.state.deleteFailure = undefined
        fake.state.actionFailure = undefined
        vi.clearAllMocks()
        store.lists = {}

        await store.load({ clusterId: 'prod', kind: pods })
    })

    it('marks a row busy while an action runs and releases it after', async () => {
        const pending = store.remove(target('api-0'))
        expect(store.stateOf('prod', pods).busyKeys).toEqual(['api-0'])

        await expect(pending).resolves.toBe(true)
        expect(store.stateOf('prod', pods).busyKeys).toEqual([])
    })

    it('reports a refused delete instead of pretending it worked', async () => {
        fake.state.deleteFailure = new ApiError('The cluster denied access to this resource', '', 403)

        await expect(store.remove(target('api-0'))).resolves.toBe(false)
        expect(errors).toHaveLength(1)
        expect(store.stateOf('prod', pods).busyKeys).toEqual([])
    })

    it('announces a delete so something can acknowledge it', async () => {
        await store.remove(target('api-0'))

        expect(announced).toEqual([new ResourceDeletedEvent('prod', 'Pod', 'api-0', 'payments')])
    })

    it('scales through the action service and announces the new count', async () => {
        await expect(store.scale(target('api-0'), 3)).resolves.toBe(true)

        expect(fake.scale).toHaveBeenCalledWith(target('api-0'), 3)
        expect(announced).toEqual([new WorkloadScaledEvent('prod', 'Pod', 'api-0', 'payments', 3)])
    })

    it('restarts a rollout and announces it', async () => {
        await expect(store.restart(target('api-0'))).resolves.toBe(true)

        expect(announced).toEqual([new WorkloadRestartedEvent('prod', 'Pod', 'api-0', 'payments')])
    })

    it('triggers a cron job and announces the run the cluster created', async () => {
        const cronJob = CronJobEntity.build({ uid: 'c1', metadata: { uid: 'c1', name: 'nightly-report', namespace: 'payments' } })

        await expect(store.trigger(target('nightly-report', cronJobs), {
            clusterId: 'prod',
            cronJob,
            jobKind: jobs,
        })).resolves.toBe(true)

        expect(announced).toEqual([
            new CronJobTriggeredEvent('prod', 'nightly-report', 'payments', 'nightly-report-x7k2p'),
        ])
    })

    it('announces nothing when an action failed', async () => {
        fake.state.actionFailure = new ApiError('The cluster rejected the object as invalid', '', 422)

        await expect(store.scale(target('api-0'), 3)).resolves.toBe(false)

        expect(announced).toEqual([])
        expect(errors).toHaveLength(1)
    })
})
