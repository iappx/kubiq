import type { TQueryMeta } from '@iappx/entity-repo-query'
import type { TPrometheusTarget } from '@/domain/models/metrics'
import type { TPrometheusEndpoint } from '@/infrastructure/entityRepo/metrics/types/TPrometheusEndpoint'

export class PrometheusQueryMeta {
    public static readonly targetKey: string = 'prometheusTarget'

    public static readonly endpointKey: string = 'prometheusEndpoint'

    public static forEndpoint(endpoint: TPrometheusEndpoint): TQueryMeta {
        return { [PrometheusQueryMeta.endpointKey]: endpoint }
    }

    public static forTarget(target: TPrometheusTarget): TQueryMeta {
        return { [PrometheusQueryMeta.targetKey]: target }
    }

    public static endpointOf(meta?: TQueryMeta): TPrometheusEndpoint {
        const endpoint = meta ? meta[PrometheusQueryMeta.endpointKey] : undefined

        return endpoint === 'query' ? 'query' : 'query_range'
    }

    public static targetOf(meta?: TQueryMeta): TPrometheusTarget | undefined {
        const target = meta ? meta[PrometheusQueryMeta.targetKey] : undefined
        if (!target || typeof target !== 'object') {
            return undefined
        }

        const candidate = target as Partial<TPrometheusTarget>

        return candidate.namespace && candidate.service && candidate.port
            ? { namespace: candidate.namespace, service: candidate.service, port: candidate.port }
            : undefined
    }
}
