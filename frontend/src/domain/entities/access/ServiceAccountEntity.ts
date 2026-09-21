import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TKubeLocalObjectRef } from '@/domain/entities/kube/types/TKubeLocalObjectRef'
import type { TKubeObjectRef } from '@/domain/entities/kube/types/TKubeObjectRef'

export class ServiceAccountEntity extends RepoEntityBase<ServiceAccountEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    secrets: TKubeObjectRef[]

    @RepoEntityField()
    imagePullSecrets: TKubeLocalObjectRef[]

    @RepoEntityField()
    automountServiceAccountToken: boolean

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get secretCount(): number {
        return (this.secrets ?? []).length
    }
}
