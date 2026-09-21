import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'

export class PinnedClusterEntity extends RepoEntityBase<PinnedClusterEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    contextName: string

    @RepoEntityField()
    pinnedAt: number
}
