import { inject } from 'tsyringe'
import { ClusterAppearanceService } from '@/application/services/clusterAppearance/ClusterAppearanceService'
import type { TClusterAppearance } from '@/application/services/clusterAppearance/types/TClusterAppearance'
import type { TClusterAppearanceDraft } from '@/domain/entities/catalog/types/TClusterAppearanceDraft'
import type { TClusterIcon } from '@/domain/entities/catalog/types/TClusterIcon'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, LoadableItemStoreBase } from '@/lib/vue-store'

@InjectableStore
export class ClusterAppearanceStore extends LoadableItemStoreBase<TClusterAppearance, ClusterAppearanceStore> {
    constructor(
        @inject(ClusterAppearanceService) private readonly appearanceService: ClusterAppearanceService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public find(clusterId: string): TClusterAppearance | undefined {
        return this.items.find(item => item.clusterId === clusterId)
    }

    public isCustomized(clusterId: string): boolean {
        return this.find(clusterId) !== undefined
    }

    public appearanceOf(clusterId: string): TClusterAppearance {
        return this.find(clusterId) ?? ClusterAppearanceService.defaultOf(clusterId)
    }

    public displayNameOf(clusterId: string): string {
        return this.find(clusterId)?.displayName || clusterId
    }

    public iconOf(clusterId: string): TClusterIcon {
        return this.appearanceOf(clusterId).icon
    }

    public async loadOnce(): Promise<void> {
        await this.guard('ClusterAppearanceStore.load', () => this.loadIfNeeded())
    }

    public save(clusterId: string, draft: TClusterAppearanceDraft): Promise<boolean> {
        return this.guard('ClusterAppearanceStore.save', async () => {
            const saved = await this.appearanceService.save(clusterId, draft, Date.now())
            this.items = [...this.items.filter(item => item.clusterId !== clusterId), saved]
        })
    }

    public reset(clusterId: string): Promise<boolean> {
        return this.guard('ClusterAppearanceStore.reset', async () => {
            await this.appearanceService.reset(clusterId)
            this.items = this.items.filter(item => item.clusterId !== clusterId)
        })
    }

    protected loadItems(): Promise<TClusterAppearance[]> {
        return this.appearanceService.getAll()
    }

    private async guard(context: string, action: () => Promise<void>): Promise<boolean> {
        try {
            await action()
            return true
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, context))
            return false
        }
    }
}
