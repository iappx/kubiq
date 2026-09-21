import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'

// A PriorityClass keeps its settings at the top level of the object, not in a spec.
export class PriorityClassEntity extends RepoEntityBase<PriorityClassEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    value: number

    @RepoEntityField()
    globalDefault: boolean

    @RepoEntityField()
    preemptionPolicy: string

    @RepoEntityField()
    description: string

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get isGlobalDefault(): boolean {
        return this.globalDefault === true
    }
}
