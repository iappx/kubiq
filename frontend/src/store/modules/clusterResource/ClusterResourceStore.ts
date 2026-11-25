import { inject } from 'tsyringe'
import type { RepoEntityBase } from '@iappx/entity-repo'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import type { TResourceListRequest } from '@/application/services/resourceList/types/TResourceListRequest'
import type { TResourceListResult } from '@/application/services/resourceList/types/TResourceListResult'
import { ResourceWatchService } from '@/application/services/resourceWatch/ResourceWatchService'
import type { TResourceChange } from '@/application/services/resourceWatch/types/TResourceChange'
import { WorkloadActionService } from '@/application/services/workloadAction/WorkloadActionService'
import type { TCronJobTriggerRequest } from '@/application/services/workloadAction/types/TCronJobTriggerRequest'
import type { TWorkloadTarget } from '@/application/services/workloadAction/types/TWorkloadTarget'
import { KubeObjectKey } from '@/domain/entities/kube'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { BulkActionCompletedEvent } from '@/domain/events/cluster/BulkActionCompletedEvent'
import { CronJobSuspendedEvent } from '@/domain/events/cluster/CronJobSuspendedEvent'
import { CronJobTriggeredEvent } from '@/domain/events/cluster/CronJobTriggeredEvent'
import { ResourceDeletedEvent } from '@/domain/events/cluster/ResourceDeletedEvent'
import { WorkloadRestartedEvent } from '@/domain/events/cluster/WorkloadRestartedEvent'
import { WorkloadScaledEvent } from '@/domain/events/cluster/WorkloadScaledEvent'
import { ApiError } from '@/domain/errors/ApiError'
import type { KubeResourceKind } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'
import { InjectableStore, StoreBase } from '@/lib/vue-store'
import { ResourceListStateFactory } from '@/store/modules/clusterResource/ResourceListStateFactory'
import type { TBulkActionOutcome } from '@/store/modules/clusterResource/types/TBulkActionOutcome'
import type { TResourceListState } from '@/store/modules/clusterResource/types/TResourceListState'

@InjectableStore
export class ClusterResourceStore extends StoreBase<ClusterResourceStore> {
    private static readonly bulkBatchSize: number = 5

    public lists: Record<string, TResourceListState> = {}

    private readonly generations = new Map<string, number>()

    constructor(
        @inject(ResourceListService) private readonly listService: ResourceListService,
        @inject(ResourceWatchService) private readonly watchService: ResourceWatchService,
        @inject(WorkloadActionService) private readonly actionService: WorkloadActionService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public static keyOf(clusterId: string, kind: KubeResourceKind): string {
        return `${clusterId}|${kind.key}`
    }

    public stateOf(clusterId: string, kind: KubeResourceKind | null): TResourceListState {
        const stored = kind ? this.lists[ClusterResourceStore.keyOf(clusterId, kind)] : undefined

        return stored ?? ResourceListStateFactory.empty()
    }

    public async load(request: TResourceListRequest): Promise<void> {
        const key = ClusterResourceStore.keyOf(request.clusterId, request.kind)
        this.bumpGeneration(key)
        this.patch(key, { loading: true, loadingMore: false, error: '', errorDetail: '', forbidden: false })

        try {
            const result = await this.listService.list(request)
            this.setItems(request.clusterId, request.kind, result.items, result.total, result.cursors, result.hasMore)
        } catch (err) {
            this.rememberFailure(key, err)
        } finally {
            this.patch(key, { loading: false })
        }
    }

    public async loadMore(request: TResourceListRequest): Promise<void> {
        const key = ClusterResourceStore.keyOf(request.clusterId, request.kind)
        const state = this.byKey(key)

        if (!state.loaded || !state.hasMore || state.loadingMore || state.loading) {
            return
        }

        const generation = this.generationOf(key)
        this.patch(key, { loadingMore: true })

        try {
            const result = await this.listService.listMore(request, state.cursors)
            if (this.generationOf(key) !== generation || !(key in this.lists)) {
                return
            }

            const current = this.byKey(key)
            const items = ClusterResourceStore.mergeItems(current.items, result.items)
            const total = ClusterResourceStore.nextTotal(current.total, items.length, result)

            this.patch(key, {
                items,
                total,
                cursors: result.cursors,
                hasMore: result.hasMore,
            })
        } catch (err) {
            if (this.generationOf(key) !== generation || !(key in this.lists)) {
                return
            }
            if (KubeStatusReader.isGone(err)) {
                const current = this.byKey(key)
                this.patch(key, {
                    cursors: current.cursors.map(cursor => ({
                        namespace: cursor.namespace,
                        resourceVersion: cursor.resourceVersion,
                    })),
                    hasMore: false,
                })
            }
            if (!KubeStatusReader.isForbidden(err)) {
                this.eventBus.emitEvent(new AppErrorEvent(err, 'ClusterResourceStore.loadMore'))
            }
        } finally {
            if (this.generationOf(key) === generation && key in this.lists) {
                this.patch(key, { loadingMore: false })
            }
        }
    }

    public setItems(
        clusterId: string,
        kind: KubeResourceKind,
        items: RepoEntityBase[],
        total?: number,
        cursors: TResourceListState['cursors'] = [],
        hasMore: boolean = false,
    ): void {
        // The tint marks what a live watch changed, so a relist clears it rather than flashing every row.
        this.patch(ClusterResourceStore.keyOf(clusterId, kind), {
            items,
            total,
            loaded: true,
            cursors,
            hasMore,
            loadingMore: false,
            flashKeys: [],
        })
    }

    public async watch(request: TResourceListRequest): Promise<void> {
        const key = ClusterResourceStore.keyOf(request.clusterId, request.kind)
        const state = this.byKey(key)

        if (!request.kind.canWatch || !state.loaded || state.cursors.length === 0) {
            return
        }

        try {
            await this.watchService.start({
                clusterId: request.clusterId,
                kind: request.kind,
                cursors: state.cursors,
                labelSelector: request.labelSelector,
                fieldSelector: request.fieldSelector,
            }, {
                onChanges: changes => this.applyChanges(request.clusterId, request.kind, changes),
                onResync: () => void this.refresh(request),
                onStale: at => this.markStale(key, at),
            })

            this.patch(key, { watching: true, staleSince: 0 })
        } catch (err) {
            this.markStale(key, Date.now())
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ClusterResourceStore.watch'))
        }
    }

    public async unwatch(clusterId: string, kind: KubeResourceKind): Promise<void> {
        await this.watchService.stop(clusterId, kind)
        this.patch(ClusterResourceStore.keyOf(clusterId, kind), { watching: false, staleSince: 0, flashKeys: [] })
    }

    public async refresh(request: TResourceListRequest): Promise<void> {
        await this.unwatch(request.clusterId, request.kind)
        await this.load(request)
        await this.watch(request)
    }

    public applyChanges(clusterId: string, kind: KubeResourceKind, changes: readonly TResourceChange[]): void {
        const key = ClusterResourceStore.keyOf(clusterId, kind)
        const state = this.byKey(key)
        if (!state.loaded || changes.length === 0) {
            return
        }

        // Deletions leave a hole compacted once at the end: a splice per event makes a burst of a thousand quadratic.
        const slots: (RepoEntityBase | undefined)[] = [...state.items]
        const positions = new Map<string, number>()
        state.items.forEach((item, index) => positions.set(KubeObjectKey.of(item), index))

        const touched: string[] = []
        let removed = 0
        let added = 0

        changes.forEach((change) => {
            const at = positions.get(change.key)

            if (change.type === 'deleted') {
                if (at !== undefined) {
                    slots[at] = undefined
                    positions.delete(change.key)
                    removed++
                }
                return
            }

            if (at === undefined) {
                positions.set(change.key, slots.length)
                slots.push(change.entity)
                added++
            } else {
                slots[at] = change.entity
            }
            touched.push(change.key)
        })

        this.patch(key, {
            items: removed === 0 ? slots as RepoEntityBase[] : slots.filter((item): item is RepoEntityBase => !!item),
            total: ClusterResourceStore.shiftTotal(state.total, added - removed),
            flashKeys: touched,
        })
    }

    public scale(target: TWorkloadTarget, replicas: number): Promise<boolean> {
        return this.act(target, 'ClusterResourceStore.scale', async () => {
            await this.actionService.scale(target, replicas)
            this.eventBus.emitEvent(
                new WorkloadScaledEvent(target.clusterId, target.kind.kind, target.name, target.namespace, replicas),
            )
        })
    }

    public restart(target: TWorkloadTarget): Promise<boolean> {
        return this.act(target, 'ClusterResourceStore.restart', async () => {
            await this.actionService.restart(target)
            this.eventBus.emitEvent(
                new WorkloadRestartedEvent(target.clusterId, target.kind.kind, target.name, target.namespace),
            )
        })
    }

    public trigger(target: TWorkloadTarget, request: TCronJobTriggerRequest): Promise<boolean> {
        return this.act(target, 'ClusterResourceStore.trigger', async () => {
            const jobName = await this.actionService.trigger(request)
            this.eventBus.emitEvent(
                new CronJobTriggeredEvent(target.clusterId, target.name, target.namespace, jobName, request.jobKind),
            )
        })
    }

    public setSuspended(target: TWorkloadTarget, suspended: boolean): Promise<boolean> {
        return this.act(target, 'ClusterResourceStore.setSuspended', async () => {
            await this.actionService.setSuspended(target, suspended)
            this.eventBus.emitEvent(
                new CronJobSuspendedEvent(target.clusterId, target.name, target.namespace, suspended),
            )
        })
    }

    public remove(target: TWorkloadTarget): Promise<boolean> {
        return this.act(target, 'ClusterResourceStore.remove', async () => {
            await this.listService.delete(target.clusterId, target.kind, target.name, target.namespace)
            this.eventBus.emitEvent(
                new ResourceDeletedEvent(target.clusterId, target.kind.kind, target.name, target.namespace),
            )
        })
    }

    public bulkRemove(targets: readonly TWorkloadTarget[]): Promise<TBulkActionOutcome> {
        return this.runBulk(
            targets,
            'delete',
            'ClusterResourceStore.bulkRemove',
            target => this.listService.delete(target.clusterId, target.kind, target.name, target.namespace),
        )
    }

    public bulkRestart(targets: readonly TWorkloadTarget[]): Promise<TBulkActionOutcome> {
        return this.runBulk(
            targets,
            'restart',
            'ClusterResourceStore.bulkRestart',
            target => this.actionService.restart(target),
        )
    }

    public forget(clusterId: string): void {
        void this.watchService.release(clusterId)

        const prefix = `${clusterId}|`
        const remaining: Record<string, TResourceListState> = {}

        Object.keys(this.lists).forEach((key) => {
            if (key.startsWith(prefix)) {
                this.bumpGeneration(key)
            } else {
                remaining[key] = this.lists[key]
            }
        })

        this.lists = remaining
    }

    private async act(target: TWorkloadTarget, context: string, action: () => Promise<void>): Promise<boolean> {
        const key = ClusterResourceStore.keyOf(target.clusterId, target.kind)
        this.markBusy(key, target.rowKey, true)

        try {
            await action()
            return true
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, context))
            return false
        } finally {
            this.markBusy(key, target.rowKey, false)
        }
    }

    private async runBulk(
        targets: readonly TWorkloadTarget[],
        action: 'delete' | 'restart',
        context: string,
        execute: (target: TWorkloadTarget) => Promise<void>,
    ): Promise<TBulkActionOutcome> {
        if (targets.length === 0) {
            return { succeeded: 0, failed: 0 }
        }

        const first = targets[0]
        const key = ClusterResourceStore.keyOf(first.clusterId, first.kind)
        const rowKeys = targets.map(target => target.rowKey)
        this.markBusyBatch(key, rowKeys, true)

        let succeeded = 0
        let failed = 0
        let firstError: unknown

        try {
            for (let offset = 0; offset < targets.length; offset += ClusterResourceStore.bulkBatchSize) {
                const batch = targets.slice(offset, offset + ClusterResourceStore.bulkBatchSize)
                const settled = await Promise.allSettled(batch.map(target => execute(target)))

                settled.forEach((entry) => {
                    if (entry.status === 'fulfilled') {
                        succeeded++
                    } else {
                        failed++
                        if (firstError === undefined) {
                            firstError = entry.reason
                        }
                    }
                })
            }

            if (firstError !== undefined) {
                this.eventBus.emitEvent(new AppErrorEvent(firstError, context))
            }
            if (succeeded > 0) {
                this.eventBus.emitEvent(new BulkActionCompletedEvent(
                    first.clusterId,
                    action,
                    first.kind.kind,
                    first.kind.title,
                    succeeded,
                    failed,
                ))
            }

            return { succeeded, failed }
        } finally {
            this.markBusyBatch(key, rowKeys, false)
        }
    }

    private markStale(key: string, at: number): void {
        this.patch(key, { watching: false, staleSince: at })
    }

    private markBusy(key: string, rowKey: string, busy: boolean): void {
        const current = this.byKey(key).busyKeys

        this.patch(key, {
            busyKeys: busy ? [...current, rowKey] : current.filter(open => open !== rowKey),
        })
    }

    private markBusyBatch(key: string, rowKeys: readonly string[], busy: boolean): void {
        const current = this.byKey(key).busyKeys

        if (busy) {
            const present = new Set(current)
            const additions = rowKeys.filter(rowKey => !present.has(rowKey))
            if (additions.length > 0) {
                this.patch(key, { busyKeys: [...current, ...additions] })
            }
            return
        }

        const removing = new Set(rowKeys)
        this.patch(key, { busyKeys: current.filter(open => !removing.has(open)) })
    }

    private generationOf(key: string): number {
        return this.generations.get(key) ?? 0
    }

    private bumpGeneration(key: string): number {
        const next = this.generationOf(key) + 1
        this.generations.set(key, next)

        return next
    }

    private byKey(key: string): TResourceListState {
        return this.lists[key] ?? ResourceListStateFactory.empty()
    }

    private patch(key: string, changes: Partial<TResourceListState>): void {
        this.lists = { ...this.lists, [key]: { ...this.byKey(key), ...changes } }
    }

    private static mergeItems(existing: readonly RepoEntityBase[], incoming: readonly RepoEntityBase[]): RepoEntityBase[] {
        const merged = [...existing]
        const positions = new Map<string, number>()

        merged.forEach((item, index) => positions.set(KubeObjectKey.of(item), index))

        incoming.forEach((item) => {
            const key = KubeObjectKey.of(item)
            const at = positions.get(key)

            if (at === undefined) {
                positions.set(key, merged.length)
                merged.push(item)
            } else {
                merged[at] = item
            }
        })

        return merged
    }

    private static nextTotal(
        previousTotal: number | undefined,
        mergedCount: number,
        result: TResourceListResult,
    ): number | undefined {
        if (!result.hasMore) {
            return previousTotal !== undefined || result.total !== undefined ? mergedCount : undefined
        }
        if (result.total !== undefined) {
            const remaining = Math.max(result.total - result.items.length, 0)
            return mergedCount + remaining
        }

        return previousTotal !== undefined ? Math.max(previousTotal, mergedCount) : undefined
    }

    private static shiftTotal(total: number | undefined, by: number): number | undefined {
        return total === undefined ? undefined : Math.max(total + by, 0)
    }

    // A refusal raises no error event: it is a state the list itself shows, and no retry can change an RBAC decision.
    private rememberFailure(key: string, err: unknown): void {
        this.patch(key, {
            error: err instanceof ApiError ? err.message : 'The list could not be read',
            errorDetail: err instanceof ApiError ? (err.details ?? '') : String(err),
            forbidden: KubeStatusReader.isForbidden(err),
        })

        if (!KubeStatusReader.isForbidden(err)) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ClusterResourceStore.load'))
        }
    }
}
