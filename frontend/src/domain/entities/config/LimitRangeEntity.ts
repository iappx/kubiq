import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TLimitRangeItem } from '@/domain/entities/config/types/TLimitRangeItem'
import type { TLimitRangeSpec } from '@/domain/entities/config/types/TLimitRangeSpec'

export class LimitRangeEntity extends RepoEntityBase<LimitRangeEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TLimitRangeSpec

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get limits(): TLimitRangeItem[] {
        return this.spec?.limits ?? []
    }

    get limitTypes(): string[] {
        return this.limits.map(limit => limit.type ?? '').filter(type => type.length > 0)
    }

    get limitTypesText(): string {
        return this.limitTypes.join(', ')
    }

    get limitCount(): number {
        return this.limits.length
    }
}
