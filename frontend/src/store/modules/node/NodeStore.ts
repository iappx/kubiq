import { inject } from 'tsyringe'
import { NodeService } from '@/application/services/node/NodeService'
import type { TNodeDrainRequest } from '@/application/services/node/types/TNodeDrainRequest'
import type { TNodePodsRequest } from '@/application/services/node/types/TNodePodsRequest'
import type { TNodeTarget } from '@/application/services/node/types/TNodeTarget'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { NodeDrainedEvent } from '@/domain/events/cluster/NodeDrainedEvent'
import { NodeSchedulingChangedEvent } from '@/domain/events/cluster/NodeSchedulingChangedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'
import { InjectableStore, StoreBase } from '@/lib/vue-store'
import { NodePodsStateFactory } from '@/store/modules/node/NodePodsStateFactory'
import type { TNodePodsState } from '@/store/modules/node/types/TNodePodsState'

@InjectableStore
export class NodeStore extends StoreBase<NodeStore> {
    public pods: Record<string, TNodePodsState> = {}

    public actingKeys: string[] = []

    constructor(
        @inject(NodeService) private readonly nodeService: NodeService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public static keyOf(clusterId: string, nodeName: string): string {
        return `${clusterId}|${nodeName}`
    }

    public podsOf(clusterId: string, nodeName: string): TNodePodsState {
        return this.pods[NodeStore.keyOf(clusterId, nodeName)] ?? NodePodsStateFactory.empty()
    }

    public busyRowKeys(clusterId: string): string[] {
        const prefix = `${clusterId}|`

        return this.actingKeys
            .filter(key => key.startsWith(prefix))
            .map(key => key.slice(prefix.length))
    }

    public async loadPods(request: TNodePodsRequest): Promise<void> {
        const key = NodeStore.keyOf(request.clusterId, request.nodeName)
        this.patch(key, { loading: true, error: '', errorDetail: '', forbidden: false })

        try {
            this.patch(key, { pods: await this.nodeService.podsOn(request), loaded: true })
        } catch (err) {
            this.patch(key, {
                error: err instanceof ApiError ? err.message : 'The pods on this node could not be read',
                errorDetail: err instanceof ApiError ? (err.details ?? '') : String(err),
                forbidden: KubeStatusReader.isForbidden(err),
            })
            if (!KubeStatusReader.isForbidden(err)) {
                this.eventBus.emitEvent(new AppErrorEvent(err, 'NodeStore.loadPods'))
            }
        } finally {
            this.patch(key, { loading: false })
        }
    }

    public cordon(target: TNodeTarget): Promise<boolean> {
        return this.setScheduling(target, true)
    }

    public uncordon(target: TNodeTarget): Promise<boolean> {
        return this.setScheduling(target, false)
    }

    public drain(request: TNodeDrainRequest): Promise<boolean> {
        return this.act(request.target, 'NodeStore.drain', async () => {
            const result = await this.nodeService.drain(request)
            this.eventBus.emitEvent(new NodeDrainedEvent(
                request.target.clusterId,
                request.target.name,
                result.evicted,
                result.skipped,
                result.failures.length,
            ))
        })
    }

    public forget(clusterId: string): void {
        const prefix = `${clusterId}|`
        const remaining: Record<string, TNodePodsState> = {}

        Object.keys(this.pods).forEach((key) => {
            if (!key.startsWith(prefix)) {
                remaining[key] = this.pods[key]
            }
        })

        this.pods = remaining
        this.actingKeys = this.actingKeys.filter(key => !key.startsWith(prefix))
    }

    private setScheduling(target: TNodeTarget, cordoned: boolean): Promise<boolean> {
        return this.act(target, 'NodeStore.setScheduling', async () => {
            await (cordoned ? this.nodeService.cordon(target) : this.nodeService.uncordon(target))
            this.eventBus.emitEvent(new NodeSchedulingChangedEvent(target.clusterId, target.name, cordoned))
        })
    }

    private async act(target: TNodeTarget, context: string, action: () => Promise<void>): Promise<boolean> {
        const key = NodeStore.keyOf(target.clusterId, target.rowKey)
        this.actingKeys = [...this.actingKeys, key]

        try {
            await action()
            return true
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, context))
            return false
        } finally {
            this.actingKeys = this.actingKeys.filter(open => open !== key)
        }
    }

    private patch(key: string, changes: Partial<TNodePodsState>): void {
        const current = this.pods[key] ?? NodePodsStateFactory.empty()

        this.pods = { ...this.pods, [key]: { ...current, ...changes } }
    }
}
