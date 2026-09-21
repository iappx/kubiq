import { inject } from 'tsyringe'
import type { RepoEntityBase } from '@iappx/entity-repo'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import type { TResourceListRequest } from '@/application/services/resourceList/types/TResourceListRequest'
import { ResourceWatchService } from '@/application/services/resourceWatch/ResourceWatchService'
import type { TResourceChange } from '@/application/services/resourceWatch/types/TResourceChange'
import { WorkloadActionService } from '@/application/services/workloadAction/WorkloadActionService'
import type { TCronJobTriggerRequest } from '@/application/services/workloadAction/types/TCronJobTriggerRequest'
import type { TWorkloadTarget } from '@/application/services/workloadAction/types/TWorkloadTarget'
import { KubeObjectKey } from '@/domain/entities/kube'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
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
import type { TResourceListState } from '@/store/modules/clusterResource/types/TResourceListState'

@InjectableStore
export class ClusterResourceStore extends StoreBase<ClusterResourceStore> {
    public lists: Record<string, TResourceListState> = {}

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
        this.patch(key, { loading: true, error: '', errorDetail: '', forbidden: false })

        try {
            const result = await this.listService.list(request)
            this.setItems(request.clusterId, request.kind, result.items, result.total, result.cursors)
        } catch (err) {
            this.rememberFailure(key, err)
        } finally {
            this.patch(key, { loading: false })
        }
    }

    public setItems(
        clusterId: string,
        kind: KubeResourceKind,
        items: RepoEntityBase[],
        total?: number,
        cursors: TResourceListState['cursors'] = [],
    ): void {
        // The tint marks what a live watch changed, so a relist clears it rather than flashing every row.
        this.patch(ClusterResourceStore.keyOf(clusterId, kind), { items, total, loaded: true, cursors, flashKeys: [] })
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
                new CronJobTriggeredEvent(target.clusterId, target.name, target.namespace, jobName),
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

    public forget(clusterId: string): void {
        void this.watchService.release(clusterId)

        const prefix = `${clusterId}|`
        const remaining: Record<string, TResourceListState> = {}

        Object.keys(this.lists).forEach((key) => {
            if (!key.startsWith(prefix)) {
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

    private markStale(key: string, at: number): void {
        this.patch(key, { watching: false, staleSince: at })
    }

    private markBusy(key: string, rowKey: string, busy: boolean): void {
        const current = this.byKey(key).busyKeys

        this.patch(key, {
            busyKeys: busy ? [...current, rowKey] : current.filter(open => open !== rowKey),
        })
    }

    private byKey(key: string): TResourceListState {
        return this.lists[key] ?? ResourceListStateFactory.empty()
    }

    private patch(key: string, changes: Partial<TResourceListState>): void {
        this.lists = { ...this.lists, [key]: { ...this.byKey(key), ...changes } }
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
