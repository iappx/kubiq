import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import type { THelmReleaseStatus } from '@/domain/entities/helm/types/THelmReleaseStatus'

export class HelmRevisionEntity extends RepoEntityBase<HelmRevisionEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    id: string

    @RepoEntityField()
    releaseName: string

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
    appVersion: string

    @RepoEntityField()
    description: string
}
