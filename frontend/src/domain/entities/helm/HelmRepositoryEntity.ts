import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'

export class HelmRepositoryEntity extends RepoEntityBase<HelmRepositoryEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    name: string

    @RepoEntityField()
    url: string
}
