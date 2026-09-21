import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'

export class OwnerReferenceEntity extends RepoEntityBase<OwnerReferenceEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField()
    name: string

    @RepoEntityField()
    controller: boolean

    @RepoEntityField()
    blockOwnerDeletion: boolean
}
