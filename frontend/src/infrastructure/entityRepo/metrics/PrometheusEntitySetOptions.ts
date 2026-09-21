import type { TRestQueryOptions } from '@iappx/entity-repo-rest'
import { KubeContinuePagingEncoder } from '@/infrastructure/entityRepo/kube/strategies/KubeContinuePagingEncoder'
import { KubeNoOrderEncoder } from '@/infrastructure/entityRepo/kube/strategies/KubeNoOrderEncoder'
import { KubeNoSelectionEncoder } from '@/infrastructure/entityRepo/kube/strategies/KubeNoSelectionEncoder'
import { PrometheusQueryMeta } from '@/infrastructure/entityRepo/metrics/PrometheusQueryMeta'
import { PrometheusNoFilterEncoder } from '@/infrastructure/entityRepo/metrics/strategies/PrometheusNoFilterEncoder'
import { PrometheusResponseAdapter } from '@/infrastructure/entityRepo/metrics/strategies/PrometheusResponseAdapter'
import { PrometheusUrlBuilder } from '@/infrastructure/entityRepo/metrics/strategies/PrometheusUrlBuilder'
import type { TPrometheusEndpoint } from '@/infrastructure/entityRepo/metrics/types/TPrometheusEndpoint'

export class PrometheusEntitySetOptions {
    public static readonly dialect: string = 'PrometheusProxyDialect'

    public static range(): TRestQueryOptions {
        return PrometheusEntitySetOptions.forEndpoint('query_range')
    }

    public static instant(): TRestQueryOptions {
        return PrometheusEntitySetOptions.forEndpoint('query')
    }

    private static forEndpoint(endpoint: TPrometheusEndpoint): TRestQueryOptions {
        return {
            dialect: PrometheusEntitySetOptions.dialect,
            pagingKind: 'cursor',
            filterEncoder: new PrometheusNoFilterEncoder(),
            orderEncoder: new KubeNoOrderEncoder(),
            pagingEncoder: new KubeContinuePagingEncoder(),
            selectionEncoder: new KubeNoSelectionEncoder(),
            urlBuilder: new PrometheusUrlBuilder(),
            responseAdapter: new PrometheusResponseAdapter(),
            meta: PrometheusQueryMeta.forEndpoint(endpoint),
        }
    }
}
