import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { TestObjectMetaEntity } from './TestObjectMetaEntity'

export class TestPodEntity extends RepoEntityBase<TestPodEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => TestObjectMetaEntity })
    metadata: TestObjectMetaEntity

    @RepoEntityField()
    spec: Record<string, unknown>

    @RepoEntityField()
    status: Record<string, unknown>
}
