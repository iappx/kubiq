import { inject, injectable } from 'tsyringe'
import { ResourceEventLimits } from '@/application/services/resourceEvents/constants/ResourceEventLimits'
import { ResourceEventSelector } from '@/application/services/resourceEvents/models/ResourceEventSelector'
import type { TObjectEventsRequest } from '@/application/services/resourceEvents/types/TObjectEventsRequest'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import type { TResourceListResult } from '@/application/services/resourceList/types/TResourceListResult'
import { ResourceWatchService } from '@/application/services/resourceWatch/ResourceWatchService'
import type { TResourceWatchHandlers } from '@/application/services/resourceWatch/types/TResourceWatchHandlers'
import type { TResourceScopeCursor } from '@/application/services/resourceList/types/TResourceScopeCursor'
import { KubeKindLocator, KubeResourceKind, KubeResourceRegistry } from '@/domain/models/kube'

@injectable()
export class ResourceEventsService {
    public static readonly eventsKey: string = KubeResourceKind.registryKeyOf('', 'events')

    constructor(
        @inject(ResourceListService) private readonly listService: ResourceListService,
        @inject(ResourceWatchService) private readonly watchService: ResourceWatchService,
    ) {}

    public static scopeOf(request: TObjectEventsRequest): string {
        return request.uid !== '' ? request.uid : `${request.kind.kind}/${request.namespace}/${request.name}`
    }

    // A cluster serving only events.k8s.io is left alone: its involvedObject has another shape.
    public kindOf(request: TObjectEventsRequest): KubeResourceKind | undefined {
        return request.served.find(kind => kind.registryKey === ResourceEventsService.eventsKey)
            ?? KubeKindLocator.find(KubeResourceRegistry.all(), 'v1', 'Event')
    }

    public list(request: TObjectEventsRequest): Promise<TResourceListResult> {
        const kind = this.kindOf(request)
        if (!kind) {
            return Promise.resolve({ items: [], cursors: [] })
        }

        return this.listService.list({
            clusterId: request.clusterId,
            kind,
            namespaces: request.namespace === '' ? [] : [request.namespace],
            fieldSelector: ResourceEventSelector.forObject(request),
            limit: ResourceEventLimits.pageSize,
        })
    }

    public async watch(
        request: TObjectEventsRequest,
        cursors: readonly TResourceScopeCursor[],
        handlers: TResourceWatchHandlers,
    ): Promise<boolean> {
        const kind = this.kindOf(request)
        if (!kind || !kind.canWatch || cursors.length === 0) {
            return false
        }

        await this.watchService.start({
            clusterId: request.clusterId,
            kind,
            cursors,
            fieldSelector: ResourceEventSelector.forObject(request),
            scope: ResourceEventsService.scopeOf(request),
        }, handlers)

        return true
    }

    public async stop(request: TObjectEventsRequest): Promise<void> {
        const kind = this.kindOf(request)
        if (kind) {
            await this.watchService.stop(request.clusterId, kind, ResourceEventsService.scopeOf(request))
        }
    }
}
