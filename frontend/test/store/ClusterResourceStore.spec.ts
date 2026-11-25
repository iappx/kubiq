import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = {
        result: {
            items: [] as unknown[],
            total: undefined as number | undefined,
            cursors: [] as { namespace: string, resourceVersion: string, continueToken?: string }[],
            hasMore: false,
        },
        moreResult: {
            items: [] as unknown[],
            total: undefined as number | undefined,
            cursors: [] as { namespace: string, resourceVersion: string, continueToken?: string }[],
            hasMore: false,
        },
        listFailure: undefined as Error | undefined,
        listMoreFailure: undefined as Error | undefined,
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
        listMore: vi.fn(async () => {
            if (state.listMoreFailure) {
                throw state.listMoreFailure
            }
            return state.moreResult
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
        setSuspended: vi.fn(async () => {
            if (state.actionFailure) {
                throw state.actionFailure
            }
        }),
    }
})

vi.mock('@/application/services/resourceList/ResourceListService', () => ({
    ResourceListService: class {
        public list = fake.list
        public listMore = fake.listMore
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
        public setSuspended = fake.setSuspended
    },
}))

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { BulkActionCompletedEvent } from '@/domain/events/cluster/BulkActionCompletedEvent'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { CronJobSuspendedEvent } from '@/domain/events/cluster/CronJobSuspendedEvent'
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
eventBus.registerHandler(CronJobSuspendedEvent, record)
eventBus.registerHandler(ResourceDeletedEvent, record)
eventBus.registerHandler(BulkActionCompletedEvent, record)

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
        fake.state.result = { items: [object('api-0')], total: 1, cursors: [{ namespace: '', resourceVersion: '10' }], hasMore: false }
        fake.state.moreResult = { items: [], total: undefined, cursors: [], hasMore: false }
        fake.state.listFailure = undefined
        fake.state.listMoreFailure = undefined
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
        fake.state.result = { items: [object('api-0')], total: 1, cursors: [{ namespace: '', resourceVersion: '10' }], hasMore: false }
        fake.state.moreResult = { items: [], total: undefined, cursors: [], hasMore: false }
        fake.state.listFailure = undefined
        fake.state.listMoreFailure = undefined
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
        fake.state.result = { items: [object('api-0')], total: 1, cursors: [], hasMore: false }
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
            new CronJobTriggeredEvent('prod', 'nightly-report', 'payments', 'nightly-report-x7k2p', jobs),
        ])
    })

    it('passes an edited manifest through to the action service', async () => {
        const cronJob = CronJobEntity.build({ uid: 'c1', metadata: { uid: 'c1', name: 'nightly-report', namespace: 'payments' } })
        const manifest = { apiVersion: 'batch/v1', kind: 'Job', metadata: { generateName: 'nightly-report-manual-' } }
        const request = { clusterId: 'prod', cronJob, jobKind: jobs, manifest }

        await expect(store.trigger(target('nightly-report', cronJobs), request)).resolves.toBe(true)

        expect(fake.trigger).toHaveBeenCalledWith(request)
    })

    it('suspends a cron job and announces it', async () => {
        await expect(store.setSuspended(target('nightly-report', cronJobs), true)).resolves.toBe(true)

        expect(fake.setSuspended).toHaveBeenCalledWith(target('nightly-report', cronJobs), true)
        expect(announced).toEqual([new CronJobSuspendedEvent('prod', 'nightly-report', 'payments', true)])
    })

    it('resumes a cron job and announces it', async () => {
        await expect(store.setSuspended(target('nightly-report', cronJobs), false)).resolves.toBe(true)

        expect(announced).toEqual([new CronJobSuspendedEvent('prod', 'nightly-report', 'payments', false)])
    })

    it('reports a refused suspend and announces nothing', async () => {
        fake.state.actionFailure = new ApiError('The cluster denied access to this resource', '', 403)

        await expect(store.setSuspended(target('nightly-report', cronJobs), true)).resolves.toBe(false)

        expect(announced).toEqual([])
        expect(errors).toHaveLength(1)
        expect(store.stateOf('prod', cronJobs).busyKeys).toEqual([])
    })

    it('announces nothing when an action failed', async () => {
        fake.state.actionFailure = new ApiError('The cluster rejected the object as invalid', '', 422)

        await expect(store.scale(target('api-0'), 3)).resolves.toBe(false)

        expect(announced).toEqual([])
        expect(errors).toHaveLength(1)
    })
})

describe('ClusterResourceStore pagination', () => {
    beforeEach(async () => {
        errors.length = 0
        announced.length = 0
        fake.state.result = {
            items: [object('api-0'), object('api-1')],
            total: 5,
            cursors: [{ namespace: '', resourceVersion: '10', continueToken: 'tok-2' }],
            hasMore: true,
        }
        fake.state.moreResult = {
            items: [object('api-1'), object('api-2'), object('api-3')],
            total: 4,
            cursors: [{ namespace: '', resourceVersion: '10', continueToken: 'tok-3' }],
            hasMore: true,
        }
        fake.state.listFailure = undefined
        fake.state.listMoreFailure = undefined
        vi.clearAllMocks()
        store.lists = {}

        await store.load({ clusterId: 'prod', kind: pods })
    })

    it('records hasMore from the initial page load', () => {
        expect(store.stateOf('prod', pods).hasMore).toBe(true)
        expect(store.stateOf('prod', pods).loadingMore).toBe(false)
    })

    it('appends newly loaded items, deduplicating overlapping keys and updating total and cursors', async () => {
        await store.loadMore({ clusterId: 'prod', kind: pods })

        expect(fake.listMore).toHaveBeenCalledWith(
            { clusterId: 'prod', kind: pods },
            [{ namespace: '', resourceVersion: '10', continueToken: 'tok-2' }],
        )
        expect(itemNames()).toEqual(['api-0', 'api-1', 'api-2', 'api-3'])
        expect(store.stateOf('prod', pods).total).toBe(5)
        expect(store.stateOf('prod', pods).hasMore).toBe(true)
        expect(store.stateOf('prod', pods).loadingMore).toBe(false)
        expect(store.stateOf('prod', pods).cursors).toEqual([
            { namespace: '', resourceVersion: '10', continueToken: 'tok-3' },
        ])
    })

    it('clears hasMore and finalises total when the last page arrives', async () => {
        fake.state.moreResult = {
            items: [object('api-2')],
            total: undefined,
            cursors: [{ namespace: '', resourceVersion: '10' }],
            hasMore: false,
        }

        await store.loadMore({ clusterId: 'prod', kind: pods })

        expect(itemNames()).toEqual(['api-0', 'api-1', 'api-2'])
        expect(store.stateOf('prod', pods).total).toBe(3)
        expect(store.stateOf('prod', pods).hasMore).toBe(false)
    })

    it('skips loadMore when nothing more is available or the list is not loaded', async () => {
        fake.state.moreResult = {
            items: [object('api-2')],
            total: undefined,
            cursors: [{ namespace: '', resourceVersion: '10' }],
            hasMore: false,
        }
        await store.loadMore({ clusterId: 'prod', kind: pods })
        vi.clearAllMocks()

        await store.loadMore({ clusterId: 'prod', kind: pods })
        await store.loadMore({ clusterId: 'prod', kind: nodes })

        expect(fake.listMore).not.toHaveBeenCalled()
    })

    it('clears continue tokens and hasMore when the server reports 410 Gone', async () => {
        fake.state.listMoreFailure = new ApiError('The cluster no longer keeps that resource version', 'Expired', 410)

        await store.loadMore({ clusterId: 'prod', kind: pods })

        expect(store.stateOf('prod', pods).hasMore).toBe(false)
        expect(store.stateOf('prod', pods).loadingMore).toBe(false)
        expect(store.stateOf('prod', pods).cursors).toEqual([{ namespace: '', resourceVersion: '10' }])
        expect(errors).toHaveLength(1)
    })

    it('keeps hasMore true on transient errors so the user can retry', async () => {
        fake.state.listMoreFailure = new ApiError('The cluster API is not available right now.', '', 503)

        await store.loadMore({ clusterId: 'prod', kind: pods })

        expect(store.stateOf('prod', pods).hasMore).toBe(true)
        expect(store.stateOf('prod', pods).loadingMore).toBe(false)
        expect(errors).toHaveLength(1)
    })

    it('discards a stale loadMore result when a fresh load supersedes it', async () => {
        let resolveStale!: (value: typeof fake.state.moreResult) => void
        let resolveFreshMore!: (value: typeof fake.state.moreResult) => void
        fake.listMore
            .mockImplementationOnce(() => new Promise((resolve) => { resolveStale = resolve }))
            .mockImplementationOnce(() => new Promise((resolve) => { resolveFreshMore = resolve }))

        const staleMore = store.loadMore({ clusterId: 'prod', kind: pods })
        expect(store.stateOf('prod', pods).loadingMore).toBe(true)

        fake.state.result = {
            items: [object('fresh-0')],
            total: 2,
            cursors: [{ namespace: '', resourceVersion: '20', continueToken: 'fresh-tok' }],
            hasMore: true,
        }
        await store.load({ clusterId: 'prod', kind: pods })

        const freshMore = store.loadMore({ clusterId: 'prod', kind: pods })
        expect(store.stateOf('prod', pods).loadingMore).toBe(true)

        resolveStale({
            items: [object('stale-2'), object('stale-3')],
            total: 99,
            cursors: [{ namespace: '', resourceVersion: '10', continueToken: 'stale-tok' }],
            hasMore: false,
        })
        await staleMore

        expect(itemNames()).toEqual(['fresh-0'])
        expect(store.stateOf('prod', pods).total).toBe(2)
        expect(store.stateOf('prod', pods).hasMore).toBe(true)
        expect(store.stateOf('prod', pods).loadingMore).toBe(true)
        expect(store.stateOf('prod', pods).cursors).toEqual([
            { namespace: '', resourceVersion: '20', continueToken: 'fresh-tok' },
        ])

        resolveFreshMore({
            items: [object('fresh-1')],
            total: undefined,
            cursors: [{ namespace: '', resourceVersion: '20' }],
            hasMore: false,
        })
        await freshMore

        expect(itemNames()).toEqual(['fresh-0', 'fresh-1'])
        expect(store.stateOf('prod', pods).hasMore).toBe(false)
        expect(store.stateOf('prod', pods).loadingMore).toBe(false)
    })

    it('ignores a stale loadMore failure after a fresh load replaces the list', async () => {
        let rejectStale!: (reason?: unknown) => void
        fake.listMore.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectStale = reject }))

        const staleMore = store.loadMore({ clusterId: 'prod', kind: pods })

        fake.state.result = {
            items: [object('fresh-0')],
            total: 3,
            cursors: [{ namespace: '', resourceVersion: '30', continueToken: 'fresh-tok' }],
            hasMore: true,
        }
        await store.load({ clusterId: 'prod', kind: pods })

        rejectStale(new ApiError('The cluster no longer keeps that resource version', 'Expired', 410))
        await staleMore

        expect(store.stateOf('prod', pods).hasMore).toBe(true)
        expect(store.stateOf('prod', pods).cursors).toEqual([
            { namespace: '', resourceVersion: '30', continueToken: 'fresh-tok' },
        ])
        expect(errors).toEqual([])
    })
})

describe('ClusterResourceStore bulk actions', () => {
    beforeEach(async () => {
        errors.length = 0
        announced.length = 0
        fake.state.result = { items: [object('api-0')], total: 1, cursors: [], hasMore: false }
        fake.state.listFailure = undefined
        fake.state.deleteFailure = undefined
        fake.state.actionFailure = undefined
        vi.clearAllMocks()
        store.lists = {}

        await store.load({ clusterId: 'prod', kind: pods })
    })

    it('deletes selected targets in bounded batches and emits one bulk event', async () => {
        const targets = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(name => target(name))
        let inFlight = 0
        let maxInFlight = 0
        let busyDuringRun: string[] = []

        fake.remove.mockImplementation(async () => {
            inFlight++
            maxInFlight = Math.max(maxInFlight, inFlight)
            if (busyDuringRun.length === 0) {
                busyDuringRun = [...store.stateOf('prod', pods).busyKeys]
            }
            await Promise.resolve()
            inFlight--
        })

        const outcome = await store.bulkRemove(targets)

        expect(outcome).toEqual({ succeeded: 7, failed: 0 })
        expect(maxInFlight).toBeLessThanOrEqual(5)
        expect(busyDuringRun).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'])
        expect(store.stateOf('prod', pods).busyKeys).toEqual([])
        expect(errors).toEqual([])
        expect(announced).toEqual([new BulkActionCompletedEvent('prod', 'delete', 'Pod', 'Pods', 7, 0)])
    })

    it('reports partial failures with both an error event and a bulk summary event', async () => {
        const targets = [target('p0'), target('p1'), target('p2')]
        fake.remove
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new ApiError('denied', 'Forbidden', 403))
            .mockResolvedValueOnce(undefined)

        const outcome = await store.bulkRemove(targets)

        expect(outcome).toEqual({ succeeded: 2, failed: 1 })
        expect(errors).toHaveLength(1)
        expect(announced).toEqual([new BulkActionCompletedEvent('prod', 'delete', 'Pod', 'Pods', 2, 1)])
        expect(store.stateOf('prod', pods).busyKeys).toEqual([])
    })

    it('emits no bulk completion event when every target fails', async () => {
        fake.remove.mockRejectedValue(new ApiError('denied', 'Forbidden', 403))

        const outcome = await store.bulkRemove([target('p0'), target('p1')])

        expect(outcome).toEqual({ succeeded: 0, failed: 2 })
        expect(errors).toHaveLength(1)
        expect(announced).toEqual([])
    })

    it('restarts selected workloads and announces a single bulk event', async () => {
        const deployments = KubeResourceRegistry.find('apps', 'deployments')!
        const targets = [target('api', deployments), target('web', deployments)]

        const outcome = await store.bulkRestart(targets)

        expect(outcome).toEqual({ succeeded: 2, failed: 0 })
        expect(fake.restart).toHaveBeenCalledTimes(2)
        expect(announced).toEqual([new BulkActionCompletedEvent('prod', 'restart', 'Deployment', 'Deployments', 2, 0)])
    })

    it('returns zeroes immediately for an empty target list', async () => {
        expect(await store.bulkRemove([])).toEqual({ succeeded: 0, failed: 0 })
        expect(await store.bulkRestart([])).toEqual({ succeeded: 0, failed: 0 })
        expect(announced).toEqual([])
        expect(errors).toEqual([])
    })
})
