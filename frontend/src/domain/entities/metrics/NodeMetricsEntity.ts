import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { MetricQuantity } from '@/domain/models/metrics/MetricQuantity'
import type { TMetricsUsage } from '@/domain/entities/metrics/types/TMetricsUsage'

export class NodeMetricsEntity extends RepoEntityBase<NodeMetricsEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    key: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    timestamp: string

    @RepoEntityField()
    window: string

    @RepoEntityField()
    usage: TMetricsUsage

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get cpuCores(): number {
        return MetricQuantity.parse(this.usage?.cpu)
    }

    get memoryBytes(): number {
        return MetricQuantity.parse(this.usage?.memory)
    }
}
