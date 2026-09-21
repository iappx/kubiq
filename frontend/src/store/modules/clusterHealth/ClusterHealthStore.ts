import { ClusterHealthCatalog } from '@/domain/models/kube/failure/ClusterHealthCatalog'
import type { TClusterHealth } from '@/domain/models/kube/failure/types/TClusterHealth'
import type { TClusterHealthNotice } from '@/domain/models/kube/failure/types/TClusterHealthNotice'
import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class ClusterHealthStore extends StoreBase<ClusterHealthStore> {
    public health: Record<string, TClusterHealth> = {}

    public details: Record<string, string> = {}

    public online = true

    public healthOf(clusterId: string): TClusterHealth {
        return this.health[clusterId] ?? 'healthy'
    }

    public detailOf(clusterId: string): string {
        return this.details[clusterId] ?? ''
    }

    public noticeOf(clusterId: string): TClusterHealthNotice {
        return this.online
            ? ClusterHealthCatalog.notice(this.healthOf(clusterId))
            : ClusterHealthCatalog.offlineNotice()
    }

    public isSettled(clusterId: string): boolean {
        return this.online && ClusterHealthCatalog.isHealthy(this.healthOf(clusterId))
    }

    public needsReconnect(clusterId: string): boolean {
        return ClusterHealthCatalog.needsReconnect(this.healthOf(clusterId))
    }

    public set(clusterId: string, health: TClusterHealth, detail: string): void {
        this.health = { ...this.health, [clusterId]: health }
        this.details = { ...this.details, [clusterId]: detail }
    }

    public setOnline(online: boolean): void {
        this.online = online
    }

    public forget(clusterId: string): void {
        this.health = ClusterHealthStore.without(this.health, clusterId)
        this.details = ClusterHealthStore.without(this.details, clusterId)
    }

    private static without<T>(source: Record<string, T>, clusterId: string): Record<string, T> {
        if (!(clusterId in source)) {
            return source
        }

        const remaining = { ...source }
        delete remaining[clusterId]

        return remaining
    }
}
