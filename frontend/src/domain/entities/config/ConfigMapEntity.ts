import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TKubeDataMap } from '@/domain/entities/config/types/TKubeDataMap'

export class ConfigMapEntity extends RepoEntityBase<ConfigMapEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    data: TKubeDataMap

    @RepoEntityField()
    binaryData: TKubeDataMap

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

    get keys(): string[] {
        return [...Object.keys(this.data ?? {}), ...Object.keys(this.binaryData ?? {})]
    }

    get keyCount(): number {
        return this.keys.length
    }
}
