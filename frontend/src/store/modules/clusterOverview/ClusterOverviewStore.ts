import { inject } from 'tsyringe'
import { ClusterOverviewService } from '@/application/services/clusterOverview/ClusterOverviewService'
import type { TClusterOverviewRequest } from '@/application/services/clusterOverview/types/TClusterOverviewRequest'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'
import { ClusterOverviewStateFactory } from '@/store/modules/clusterOverview/ClusterOverviewStateFactory'
import type { TClusterOverviewState } from '@/store/modules/clusterOverview/types/TClusterOverviewState'

@InjectableStore
export class ClusterOverviewStore extends StoreBase<ClusterOverviewStore> {
    public overviews: Record<string, TClusterOverviewState> = {}

    constructor(
        @inject(ClusterOverviewService) private readonly overviewService: ClusterOverviewService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public stateOf(clusterId: string): TClusterOverviewState {
        return this.overviews[clusterId] ?? ClusterOverviewStateFactory.empty()
    }

    public async load(request: TClusterOverviewRequest): Promise<void> {
        this.patch(request.clusterId, { loading: true, error: '', errorDetail: '' })

        try {
            const overview = await this.overviewService.load(request)
            this.patch(request.clusterId, { overview, loaded: true })
        } catch (err) {
            this.patch(request.clusterId, {
                error: err instanceof ApiError ? err.message : 'The cluster overview could not be read',
                errorDetail: err instanceof ApiError ? (err.details ?? '') : String(err),
            })
            this.eventBus.emitEvent(new AppErrorEvent(err, 'ClusterOverviewStore.load'))
        } finally {
            this.patch(request.clusterId, { loading: false })
        }
    }

    public forget(clusterId: string): void {
        const remaining = { ...this.overviews }
        delete remaining[clusterId]

        this.overviews = remaining
    }

    private patch(clusterId: string, changes: Partial<TClusterOverviewState>): void {
        const current = this.overviews[clusterId] ?? ClusterOverviewStateFactory.empty()

        this.overviews = { ...this.overviews, [clusterId]: { ...current, ...changes } }
    }
}
