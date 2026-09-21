import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'

export class TestObjectMetaEntity extends RepoEntityBase<TestObjectMetaEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    uid: string

    @RepoEntityField()
    name: string

    @RepoEntityField()
    namespace: string

    @RepoEntityField()
    resourceVersion: string

    @RepoEntityField()
    labels: Record<string, string>
}
