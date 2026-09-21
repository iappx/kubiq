import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { SecretTypeCatalog } from '@/domain/entities/config/SecretTypeCatalog'
import type { TKubeDataMap } from '@/domain/entities/config/types/TKubeDataMap'

// The entity carries `data` because the manifest on the YAML tab has to be
// faithful; nothing here exposes a value, and nothing above it should either.
export class SecretEntity extends RepoEntityBase<SecretEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    type: string

    @RepoEntityField()
    data: TKubeDataMap

    @RepoEntityField()
    immutable: boolean

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get typeTitle(): string {
        return SecretTypeCatalog.title(this.type ?? '')
    }

    get keys(): string[] {
        return Object.keys(this.data ?? {})
    }

    get keyCount(): number {
        return this.keys.length
    }
}
