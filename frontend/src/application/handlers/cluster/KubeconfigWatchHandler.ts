import { inject, singleton } from 'tsyringe'
import { ClusterCatalogService } from '@/application/services/clusterCatalog/ClusterCatalogService'
import { KubeconfigService } from '@/application/services/kubeconfig/KubeconfigService'
import { ClusterCatalogStore } from '@/store/modules/clusterCatalog/ClusterCatalogStore'

@singleton()
export class KubeconfigWatchHandler {
    public static readonly intervalMs: number = 3000

    private stamp: string | null = null

    private checking = false

    constructor(
        @inject(KubeconfigService) private readonly kubeconfigService: KubeconfigService,
        @inject(ClusterCatalogService) private readonly catalogService: ClusterCatalogService,
        @inject(ClusterCatalogStore) private readonly catalogStore: ClusterCatalogStore,
    ) {
        setInterval(() => void this.check(), KubeconfigWatchHandler.intervalMs)
    }

    public async check(): Promise<void> {
        if (this.checking) {
            return
        }

        this.checking = true
        try {
            const stamp = await this.kubeconfigService.fingerprint(await this.catalogService.getSourcePaths())

            if (this.stamp === null || !this.catalogStore.storeLoaded) {
                this.stamp = stamp
                return
            }

            // The old stamp stays while a load is running, so the next pass still sees the change.
            if (stamp === this.stamp || this.catalogStore.storeLoading) {
                return
            }

            this.stamp = stamp
            await this.catalogStore.refresh()
        } catch {
            // The catalog load reports the same failure; repeating it every few seconds would only be noise.
        } finally {
            this.checking = false
        }
    }
}
