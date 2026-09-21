import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TLeaseSpec } from '@/domain/entities/config/types/TLeaseSpec'

export class LeaseEntity extends RepoEntityBase<LeaseEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TLeaseSpec

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get holder(): string {
        return this.spec?.holderIdentity ?? ''
    }

    get renewedAt(): string {
        return this.spec?.renewTime ?? ''
    }

    get durationSeconds(): number {
        return this.spec?.leaseDurationSeconds ?? 0
    }
}
