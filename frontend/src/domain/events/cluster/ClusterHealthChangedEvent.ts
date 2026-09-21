import type { TClusterHealth } from '@/domain/models/kube/failure/types/TClusterHealth'

export class ClusterHealthChangedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly health: TClusterHealth,
        public readonly detail: string,
    ) {}
}
