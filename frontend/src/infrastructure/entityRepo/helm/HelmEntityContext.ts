import { EntityContextBase, RepoEntitySet } from '@iappx/entity-repo'
import { HelmChartEntity } from '@/domain/entities/helm/HelmChartEntity'
import { HelmReleaseEntity } from '@/domain/entities/helm/HelmReleaseEntity'
import { HelmRepositoryEntity } from '@/domain/entities/helm/HelmRepositoryEntity'
import { HelmRevisionEntity } from '@/domain/entities/helm/HelmRevisionEntity'
import { HelmChartQuery } from '@/infrastructure/entityRepo/helm/queries/HelmChartQuery'
import { HelmReleaseQuery } from '@/infrastructure/entityRepo/helm/queries/HelmReleaseQuery'
import { HelmRepositoryQuery } from '@/infrastructure/entityRepo/helm/queries/HelmRepositoryQuery'
import { HelmRevisionQuery } from '@/infrastructure/entityRepo/helm/queries/HelmRevisionQuery'
import { HelmTransport } from '@/infrastructure/entityRepo/helm/transport/HelmTransport'

export class HelmEntityContext extends EntityContextBase<HelmTransport> {
    @RepoEntitySet(() => HelmReleaseEntity, () => HelmReleaseQuery)
    public releases: HelmReleaseQuery

    @RepoEntitySet(() => HelmRevisionEntity, () => HelmRevisionQuery, { max: HelmRevisionQuery.defaultMax })
    public revisions: HelmRevisionQuery

    @RepoEntitySet(() => HelmRepositoryEntity, () => HelmRepositoryQuery)
    public repositories: HelmRepositoryQuery

    @RepoEntitySet(() => HelmChartEntity, () => HelmChartQuery)
    public charts: HelmChartQuery

    public historyOf(name: string, namespace: string): HelmRevisionQuery {
        return this.revisions.forRelease({ name, namespace })
    }
}
