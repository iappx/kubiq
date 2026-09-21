import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import type { THelmReleaseStatus } from '@/domain/entities/helm/types/THelmReleaseStatus'

export class HelmReleaseEntity extends RepoEntityBase<HelmReleaseEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    id: string

    @RepoEntityField()
    name: string

    @RepoEntityField()
    namespace: string

    @RepoEntityField()
    revision: number

    @RepoEntityField()
    updated: string

    @RepoEntityField()
    status: THelmReleaseStatus

    @RepoEntityField()
    chart: string

    @RepoEntityField()
    chartName: string

    @RepoEntityField()
    chartVersion: string

    @RepoEntityField()
    appVersion: string
}
