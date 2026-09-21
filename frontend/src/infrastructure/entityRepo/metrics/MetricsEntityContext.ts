import { EntityContextBase, RepoEntitySet } from '@iappx/entity-repo'
import { RestEntityQuery } from '@iappx/entity-repo-rest'
import { NodeMetricsEntity, PodMetricsEntity } from '@/domain/entities/metrics'
import { KubeTransport } from '@/infrastructure/entityRepo/kube/transport/KubeTransport'
import { MetricsEntitySetOptions } from '@/infrastructure/entityRepo/metrics/MetricsEntitySetOptions'

export class MetricsEntityContext extends EntityContextBase<KubeTransport> {
    @RepoEntitySet(() => NodeMetricsEntity, () => RestEntityQuery, MetricsEntitySetOptions.nodes())
    public nodes: RestEntityQuery<NodeMetricsEntity>

    @RepoEntitySet(() => PodMetricsEntity, () => RestEntityQuery, MetricsEntitySetOptions.pods())
    public pods: RestEntityQuery<PodMetricsEntity>
}
