import type { TMetricRange } from '@/domain/models/metrics/types/TMetricRange'
import type { TMetricRangeId } from '@/domain/models/metrics/types/TMetricRangeId'

export class MetricRangeCatalog {
    public static readonly Default: TMetricRangeId = '1h'

    private static readonly spans: Record<TMetricRangeId, { title: string; seconds: number; stepSeconds: number }> = {
        '1h': { title: 'Last hour', seconds: 3600, stepSeconds: 30 },
        '6h': { title: 'Last 6 hours', seconds: 6 * 3600, stepSeconds: 120 },
        '24h': { title: 'Last day', seconds: 24 * 3600, stepSeconds: 300 },
        '7d': { title: 'Last week', seconds: 7 * 24 * 3600, stepSeconds: 1800 },
    }

    public static all(): TMetricRangeId[] {
        return Object.keys(MetricRangeCatalog.spans) as TMetricRangeId[]
    }

    public static has(id: string): boolean {
        return Object.prototype.hasOwnProperty.call(MetricRangeCatalog.spans, id)
    }

    public static parse(id: unknown): TMetricRangeId {
        return typeof id === 'string' && MetricRangeCatalog.has(id)
            ? id as TMetricRangeId
            : MetricRangeCatalog.Default
    }

    public static title(id: TMetricRangeId): string {
        return MetricRangeCatalog.spans[id]?.title ?? id
    }

    public static label(id: TMetricRangeId): string {
        return id
    }

    public static resolve(id: TMetricRangeId, now: number): TMetricRange {
        const span = MetricRangeCatalog.spans[MetricRangeCatalog.parse(id)]
        const to = Math.floor(now / 1000)

        return { from: to - span.seconds, to, stepSeconds: span.stepSeconds }
    }
}
