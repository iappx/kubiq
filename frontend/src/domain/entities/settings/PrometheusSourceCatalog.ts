import type { TPrometheusSource } from '@/domain/entities/settings/types/TPrometheusSource'

export class PrometheusSourceCatalog {
    public static readonly values: Record<TPrometheusSource, string> = {
        none: 'Not configured',
        auto: 'Discover in the cluster',
        url: 'Prometheus address',
        service: 'In-cluster service',
    }

    public static readonly Default: TPrometheusSource = 'none'

    public static title(source: TPrometheusSource): string {
        return PrometheusSourceCatalog.values[source] ?? source
    }

    public static has(source: string): boolean {
        return Object.prototype.hasOwnProperty.call(PrometheusSourceCatalog.values, source)
    }

    public static parse(source: unknown): TPrometheusSource {
        return typeof source === 'string' && PrometheusSourceCatalog.has(source)
            ? source as TPrometheusSource
            : PrometheusSourceCatalog.Default
    }

    public static isConfigured(source: TPrometheusSource): boolean {
        return source !== 'none'
    }

    public static needsAddress(source: TPrometheusSource): boolean {
        return source === 'url' || source === 'service'
    }
}
