import { inject, singleton } from 'tsyringe'
import { ClusterHealthChangedEvent } from '@/domain/events/cluster/ClusterHealthChangedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { ClusterHealthCatalog } from '@/domain/models/kube/failure/ClusterHealthCatalog'
import type { TClusterHealth } from '@/domain/models/kube/failure/types/TClusterHealth'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeClusterProbe } from '@/infrastructure/kube/KubeClusterProbe'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'

@singleton()
export class KubeHealthMonitor {
    public static readonly failuresBeforeDegraded: number = 2

    private readonly health = new Map<string, TClusterHealth>()

    private readonly details = new Map<string, string>()

    private readonly misses = new Map<string, number>()

    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {}

    public probeFor(clusterId: string): KubeClusterProbe {
        return new KubeClusterProbe(clusterId, this)
    }

    public healthOf(clusterId: string): TClusterHealth {
        return this.health.get(clusterId) ?? 'healthy'
    }

    public detailOf(clusterId: string): string {
        return this.details.get(clusterId) ?? ''
    }

    public succeeded(clusterId: string): void {
        this.misses.delete(clusterId)
        this.apply(clusterId, 'healthy', '')
    }

    public failed(clusterId: string, error: unknown): void {
        const reported = ClusterHealthCatalog.ofFailure(KubeStatusReader.kindOf(error))

        // A refusal or a missing object is the cluster answering, so it says the connection is fine.
        if (ClusterHealthCatalog.isHealthy(reported)) {
            this.succeeded(clusterId)
            return
        }

        const detail = error instanceof ApiError ? error.message : ''
        if (ClusterHealthCatalog.needsReconnect(reported)) {
            this.apply(clusterId, reported, detail)
            return
        }

        const missed = (this.misses.get(clusterId) ?? 0) + 1
        this.misses.set(clusterId, missed)

        if (missed >= KubeHealthMonitor.failuresBeforeDegraded) {
            this.apply(clusterId, reported, detail)
        }
    }

    public forget(clusterId: string): void {
        this.health.delete(clusterId)
        this.details.delete(clusterId)
        this.misses.delete(clusterId)
    }

    public forgetAll(): void {
        this.health.clear()
        this.details.clear()
        this.misses.clear()
    }

    private apply(clusterId: string, health: TClusterHealth, detail: string): void {
        if (this.healthOf(clusterId) === health) {
            return
        }

        this.health.set(clusterId, health)
        this.details.set(clusterId, detail)
        this.eventBus.emitEvent(new ClusterHealthChangedEvent(clusterId, health, detail))
    }
}
