import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'

// A StorageClass keeps its settings at the top level of the object rather than
// in a spec, so the entity mirrors that shape.
export class StorageClassEntity extends RepoEntityBase<StorageClassEntity> {
    public static readonly defaultAnnotation: string = 'storageclass.kubernetes.io/is-default-class'

    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    provisioner: string

    @RepoEntityField()
    reclaimPolicy: string

    @RepoEntityField()
    volumeBindingMode: string

    @RepoEntityField()
    allowVolumeExpansion: boolean

    @RepoEntityField()
    parameters: Record<string, string>

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get isDefault(): boolean {
        return this.metadata?.annotation(StorageClassEntity.defaultAnnotation) === 'true'
    }
}
