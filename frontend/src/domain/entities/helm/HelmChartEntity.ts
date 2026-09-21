import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'

export class HelmChartEntity extends RepoEntityBase<HelmChartEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    id: string

    @RepoEntityField()
    ref: string

    @RepoEntityField()
    repoName: string

    @RepoEntityField()
    chartName: string

    @RepoEntityField()
    version: string

    @RepoEntityField()
    appVersion: string

    @RepoEntityField()
    description: string
}
