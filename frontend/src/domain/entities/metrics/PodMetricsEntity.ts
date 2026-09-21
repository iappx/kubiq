import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { MetricQuantity } from '@/domain/models/metrics/MetricQuantity'
import type { TContainerMetrics } from '@/domain/entities/metrics/types/TContainerMetrics'

export class PodMetricsEntity extends RepoEntityBase<PodMetricsEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    key: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    timestamp: string

    @RepoEntityField()
    window: string

    @RepoEntityField()
    containers: TContainerMetrics[]

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get cpuCores(): number {
        return MetricQuantity.sum((this.containers ?? []).map(container => container.usage?.cpu))
    }

    get memoryBytes(): number {
        return MetricQuantity.sum((this.containers ?? []).map(container => container.usage?.memory))
    }

    public cpuCoresOf(container: string): number {
        return MetricQuantity.parse(this.containerOf(container)?.usage?.cpu)
    }

    public memoryBytesOf(container: string): number {
        return MetricQuantity.parse(this.containerOf(container)?.usage?.memory)
    }

    private containerOf(container: string): TContainerMetrics | undefined {
        return (this.containers ?? []).find(candidate => candidate.name === container)
    }
}
