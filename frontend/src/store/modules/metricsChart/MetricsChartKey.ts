import { MetricLevelCatalog } from '@/domain/models/metrics'
import type { TMetricRangeId, TMetricScope, TMetricSeriesKind } from '@/domain/models/metrics'

export class MetricsChartKey {
    public static of(
        clusterId: string,
        scope: TMetricScope,
        kind: TMetricSeriesKind,
        range: TMetricRangeId,
    ): string {
        return [clusterId, MetricLevelCatalog.keyOf(scope), kind, range].join('#')
    }

    public static belongsTo(key: string, clusterId: string): boolean {
        return key.startsWith(`${clusterId}#`)
    }
}
