import { RestUrlError } from '@iappx/entity-repo-rest'
import type { IUrlBuilder, TRestOperation } from '@iappx/entity-repo-rest'
import { PrometheusQueryMeta } from '@/infrastructure/entityRepo/metrics/PrometheusQueryMeta'

export class PrometheusUrlBuilder implements IUrlBuilder {
    public static readonly apiPrefix: string = '/api/v1'

    public build(operation: TRestOperation): string {
        const target = PrometheusQueryMeta.targetOf(operation.meta)
        if (!target) {
            throw new RestUrlError('The query names no Prometheus service, so its proxy path cannot be built')
        }

        const endpoint = PrometheusQueryMeta.endpointOf(operation.meta)
        const service = `${encodeURIComponent(target.service)}:${encodeURIComponent(target.port)}`
        const proxy = `${PrometheusUrlBuilder.apiPrefix}/namespaces/${encodeURIComponent(target.namespace)}`
            + `/services/${service}/proxy`

        return `${proxy}${PrometheusUrlBuilder.apiPrefix}/${endpoint}`
    }
}
