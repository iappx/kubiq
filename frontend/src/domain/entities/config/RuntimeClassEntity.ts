import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TRuntimeClassScheduling } from '@/domain/entities/config/types/TRuntimeClassScheduling'

// A RuntimeClass keeps its settings at the top level of the object, not in a spec.
export class RuntimeClassEntity extends RepoEntityBase<RuntimeClassEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    handler: string

    @RepoEntityField()
    scheduling: TRuntimeClassScheduling

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get nodeSelectorText(): string {
        const selector = this.scheduling?.nodeSelector ?? {}
        return Object.keys(selector).map(key => `${key}=${selector[key]}`).join(', ')
    }
}
