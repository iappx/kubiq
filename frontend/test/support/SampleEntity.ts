import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'

export class SampleEntity extends RepoEntityBase<SampleEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    id: string

    @RepoEntityField()
    title: string

    @RepoEntityField()
    createdAt: number
}
