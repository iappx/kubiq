import { EntityContextBase, RepoEntitySet } from '@iappx/entity-repo'
import { RestEntityQuery } from '@iappx/entity-repo-rest'
import { PrometheusSeriesEntity } from '@/domain/entities/metrics'
import { KubeTransport } from '@/infrastructure/entityRepo/kube/transport/KubeTransport'
import { PrometheusEntitySetOptions } from '@/infrastructure/entityRepo/metrics/PrometheusEntitySetOptions'

export class PrometheusEntityContext extends EntityContextBase<KubeTransport> {
    @RepoEntitySet(() => PrometheusSeriesEntity, () => RestEntityQuery, PrometheusEntitySetOptions.range())
    public range: RestEntityQuery<PrometheusSeriesEntity>

    @RepoEntitySet(() => PrometheusSeriesEntity, () => RestEntityQuery, PrometheusEntitySetOptions.instant())
    public instant: RestEntityQuery<PrometheusSeriesEntity>
}
