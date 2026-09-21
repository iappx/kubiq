import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import type { TKubeLabels } from '@/domain/entities/kube/types/TKubeLabels'
import type { TMetricPoint } from '@/domain/models/metrics/types/TMetricPoint'
import type { TPrometheusSample } from '@/domain/entities/metrics/types/TPrometheusSample'

export class PrometheusSeriesEntity extends RepoEntityBase<PrometheusSeriesEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    key: string

    @RepoEntityField()
    metric: TKubeLabels

    @RepoEntityField()
    values: TPrometheusSample[]

    public labelOf(name: string): string {
        return (this.metric ?? {})[name] ?? ''
    }

    get points(): TMetricPoint[] {
        return (this.values ?? [])
            .map(sample => ({ at: Number(sample[0]) * 1000, value: Number(sample[1]) }))
            .filter(point => Number.isFinite(point.at) && Number.isFinite(point.value))
    }
}
