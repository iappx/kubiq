import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TResourceQuotaSpec } from '@/domain/entities/config/types/TResourceQuotaSpec'
import type { TResourceQuotaStatus } from '@/domain/entities/config/types/TResourceQuotaStatus'

export class ResourceQuotaEntity extends RepoEntityBase<ResourceQuotaEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TResourceQuotaSpec

    @RepoEntityField({ isReadonly: true })
    status: TResourceQuotaStatus

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get scopes(): string[] {
        return this.spec?.scopes ?? []
    }

    get scopesText(): string {
        return this.scopes.join(', ')
    }

    get hard(): Record<string, string> {
        return this.status?.hard ?? this.spec?.hard ?? {}
    }

    get used(): Record<string, string> {
        return this.status?.used ?? {}
    }

    get limitCount(): number {
        return Object.keys(this.hard).length
    }
}
