import type { TMetricsNotice } from '@/domain/models/metrics/types/TMetricsNotice'
import type { TMetricsState } from '@/domain/models/metrics/types/TMetricsState'

export class MetricsNoticeCatalog {
    private static readonly usageNotices: Record<TMetricsState, TMetricsNotice> = {
        ready: { title: 'Usage', description: '' },
        off: {
            title: 'Usage is turned off',
            description: 'Live usage is disabled for this cluster in settings.',
        },
        missing: {
            title: 'No metrics-server',
            description: 'This cluster does not serve metrics.k8s.io. Install metrics-server to see live CPU and memory usage.',
        },
        forbidden: {
            title: 'Usage not permitted',
            description: 'You cannot read metrics.k8s.io in this cluster, so usage figures stay hidden.',
        },
        unsupported: {
            title: 'Usage unavailable',
            description: 'This cluster serves metrics.k8s.io in a shape kubiq cannot read.',
        },
    }

    private static readonly historyNotices: Record<TMetricsState, TMetricsNotice> = {
        ready: { title: 'History', description: '' },
        off: {
            title: 'Prometheus is off',
            description: 'Prometheus is turned off for this cluster in settings, so there is no history to chart.',
        },
        missing: {
            title: 'No Prometheus found',
            description: 'None of the known presets matched a service in this cluster. Point kubiq at one in settings if it lives elsewhere.',
        },
        forbidden: {
            title: 'Prometheus not permitted',
            description: 'You cannot reach the Prometheus service through the API server proxy in this cluster.',
        },
        unsupported: {
            title: 'Direct address unsupported',
            description: 'kubiq reads Prometheus through the API server proxy, so a plain address cannot be used yet. Choose an in-cluster service in settings instead.',
        },
    }

    public static readonly emptyRange: TMetricsNotice = {
        title: 'No data in this range',
        description: 'Prometheus answered, but it holds no samples for this subject over the selected period.',
    }

    public static usage(state: TMetricsState): TMetricsNotice {
        return MetricsNoticeCatalog.usageNotices[state] ?? MetricsNoticeCatalog.usageNotices.unsupported
    }

    public static history(state: TMetricsState): TMetricsNotice {
        return MetricsNoticeCatalog.historyNotices[state] ?? MetricsNoticeCatalog.historyNotices.unsupported
    }

    public static isReady(state: TMetricsState): boolean {
        return state === 'ready'
    }
}
