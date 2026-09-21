import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'

export class KubeconfigSourceEntity extends RepoEntityBase<KubeconfigSourceEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    path: string

    @RepoEntityField()
    addedAt: number
}
