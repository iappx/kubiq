import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import type { TKubeconfigSourceMode } from '@/domain/entities/catalog/types/TKubeconfigSourceMode'

export class KubeconfigSourceEntity extends RepoEntityBase<KubeconfigSourceEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    path: string

    @RepoEntityField()
    addedAt: number

    // Absent in catalogues written before Kubiq started saving pasted configs; those
    // name a file the operator already had, and deleting one is never ours to do.
    @RepoEntityField()
    origin: TKubeconfigSourceMode
}
