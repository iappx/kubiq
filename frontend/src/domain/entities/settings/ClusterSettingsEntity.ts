import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import type { TPrometheusSource } from '@/domain/entities/settings/types/TPrometheusSource'

export class ClusterSettingsEntity extends RepoEntityBase<ClusterSettingsEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    clusterId: string

    @RepoEntityField()
    prometheusSource: TPrometheusSource

    @RepoEntityField()
    prometheusUrl: string

    @RepoEntityField()
    prometheusService: string
}
