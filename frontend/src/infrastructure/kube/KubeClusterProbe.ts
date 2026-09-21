import { KubeHealthMonitor } from '@/infrastructure/kube/KubeHealthMonitor'
import type { IKubeClusterProbe } from '@/infrastructure/kube/types/IKubeClusterProbe'

export class KubeClusterProbe implements IKubeClusterProbe {
    constructor(
        private readonly clusterId: string,
        private readonly monitor: KubeHealthMonitor,
    ) {}

    public succeeded(): void {
        this.monitor.succeeded(this.clusterId)
    }

    public failed(error: unknown): void {
        this.monitor.failed(this.clusterId, error)
    }
}
