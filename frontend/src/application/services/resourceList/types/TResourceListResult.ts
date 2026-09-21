import type { RepoEntityBase } from '@iappx/entity-repo'
import type { TResourceScopeCursor } from '@/application/services/resourceList/types/TResourceScopeCursor'

export type TResourceListResult = {
    items: RepoEntityBase[]
    total?: number
    cursors: TResourceScopeCursor[]
}
