import { KubeClusterCatalog, KubeWorkloadCatalog } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import type { TMetricScope } from '@/domain/models/metrics'

export class MetricsScope {
    public static supportsUsage(kind: KubeResourceKind | null): boolean {
        return kind !== null && (KubeWorkloadCatalog.isPod(kind) || KubeClusterCatalog.isNode(kind))
    }

    public static supportsHistory(kind: KubeResourceKind | null): boolean {
        if (kind === null) {
            return false
        }

        return MetricsScope.supportsUsage(kind)
            || KubeClusterCatalog.isNamespace(kind)
            || KubeWorkloadCatalog.gathersPodsByNamePrefix(kind)
    }

    public static of(kind: KubeResourceKind | null, namespace: string, name: string): TMetricScope {
        if (kind === null) {
            return { level: 'cluster' }
        }
        if (KubeWorkloadCatalog.isPod(kind)) {
            return { level: 'pod', namespace, pod: name }
        }
        if (KubeClusterCatalog.isNode(kind)) {
            return { level: 'node', node: name }
        }
        if (KubeClusterCatalog.isNamespace(kind)) {
            return { level: 'namespace', namespace: name }
        }

        return { level: 'workload', namespace, workload: name }
    }
}
