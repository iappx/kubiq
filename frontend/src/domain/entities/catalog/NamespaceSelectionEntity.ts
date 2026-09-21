import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'

export class NamespaceSelectionEntity extends RepoEntityBase<NamespaceSelectionEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    contextName: string

    // Empty means every namespace the account can see, not none.
    @RepoEntityField()
    namespaces: string[]
}
