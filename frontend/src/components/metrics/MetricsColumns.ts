import type { TResourceRow } from '@/components/resource/types/TResourceRow'
import type { TResourceUsage } from '@/application/services/metrics/types/TResourceUsage'
import { MetricsScope } from '@/components/metrics/MetricsScope'
import { KubeWorkloadCatalog } from '@/domain/models/kube'
import type { KubeResourceKind, TKubeColumn } from '@/domain/models/kube'
import { MetricFormat } from '@/domain/models/metrics'

export class MetricsColumns {
    public static readonly cpuKey: string = 'metricsCpu'

    public static readonly memoryKey: string = 'metricsMemory'

    private static readonly columns: TKubeColumn[] = [
        { key: MetricsColumns.cpuKey, title: 'CPU', align: 'right' },
        { key: MetricsColumns.memoryKey, title: 'Memory', align: 'right' },
    ]

    public static supports(kind: KubeResourceKind | null): boolean {
        return MetricsScope.supportsUsage(kind)
    }

    public static isPodKind(kind: KubeResourceKind | null): boolean {
        return kind !== null && KubeWorkloadCatalog.isPod(kind)
    }

    // Age is the last column of every table in the brief, so usage goes in front of it.
    public static extend(columns: readonly TKubeColumn[], ageKey: string): TKubeColumn[] {
        const age = columns.findIndex(column => column.key === ageKey)
        const extra = MetricsColumns.columns.map(column => ({ ...column }))

        return age === -1
            ? [...columns, ...extra]
            : [...columns.slice(0, age), ...extra, ...columns.slice(age)]
    }

    public static apply(row: TResourceRow, usage: TResourceUsage | null): TResourceRow {
        return {
            ...row,
            [MetricsColumns.cpuKey]: usage ? MetricFormat.cores(usage.cpuCores) : '',
            [MetricsColumns.memoryKey]: usage ? MetricFormat.bytes(usage.memoryBytes) : '',
        }
    }
}
