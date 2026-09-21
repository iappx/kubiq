import type { TMetricLevel } from '@/domain/models/metrics/types/TMetricLevel'
import type { TMetricScope } from '@/domain/models/metrics/types/TMetricScope'

export class MetricLevelCatalog {
    private static readonly values: Record<TMetricLevel, string> = {
        cluster: 'Cluster',
        node: 'Node',
        namespace: 'Namespace',
        workload: 'Workload',
        pod: 'Pod',
    }

    public static title(level: TMetricLevel): string {
        return MetricLevelCatalog.values[level] ?? level
    }

    public static has(level: string): boolean {
        return Object.prototype.hasOwnProperty.call(MetricLevelCatalog.values, level)
    }

    public static keyOf(scope: TMetricScope): string {
        return [scope.level, scope.namespace ?? '', scope.node ?? '', scope.workload ?? '', scope.pod ?? ''].join('|')
    }

    public static subjectOf(scope: TMetricScope): string {
        if (scope.level === 'cluster') {
            return 'this cluster'
        }
        if (scope.level === 'node') {
            return scope.node ?? ''
        }
        if (scope.level === 'namespace') {
            return scope.namespace ?? ''
        }

        const name = scope.level === 'pod' ? scope.pod ?? '' : scope.workload ?? ''

        return scope.namespace ? `${scope.namespace}/${name}` : name
    }

    public static isAddressable(scope: TMetricScope): boolean {
        if (scope.level === 'cluster') {
            return true
        }
        if (scope.level === 'node') {
            return !!scope.node
        }
        if (scope.level === 'namespace') {
            return !!scope.namespace
        }

        return !!scope.namespace && !!(scope.level === 'pod' ? scope.pod : scope.workload)
    }
}
