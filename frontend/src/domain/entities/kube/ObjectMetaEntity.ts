import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { OwnerReferenceEntity } from '@/domain/entities/kube/OwnerReferenceEntity'
import type { TKubeAnnotations } from '@/domain/entities/kube/types/TKubeAnnotations'
import type { TKubeLabels } from '@/domain/entities/kube/types/TKubeLabels'

export class ObjectMetaEntity extends RepoEntityBase<ObjectMetaEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    uid: string

    @RepoEntityField()
    name: string

    @RepoEntityField()
    namespace: string

    @RepoEntityField()
    resourceVersion: string

    @RepoEntityField()
    generation: number

    @RepoEntityField()
    labels: TKubeLabels

    @RepoEntityField()
    annotations: TKubeAnnotations

    /** RFC 3339 timestamp. */
    @RepoEntityField()
    creationTimestamp: string

    /** RFC 3339 timestamp; set only while the object is being deleted. */
    @RepoEntityField()
    deletionTimestamp: string

    @RepoEntityField()
    finalizers: string[]

    @RepoEntityField({ nestedType: () => OwnerReferenceEntity, isArray: true })
    ownerReferences: OwnerReferenceEntity[]

    get isDeleting(): boolean {
        return !!this.deletionTimestamp
    }

    get controller(): OwnerReferenceEntity | undefined {
        return (this.ownerReferences ?? []).find(p => p.controller === true)
    }

    get labelPairs(): string[] {
        const labels = this.labels ?? {}
        return Object.keys(labels).map(key => `${key}=${labels[key]}`)
    }

    public label(key: string): string | undefined {
        return (this.labels ?? {})[key]
    }

    public annotation(key: string): string | undefined {
        return (this.annotations ?? {})[key]
    }
}
