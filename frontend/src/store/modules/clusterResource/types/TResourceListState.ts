import type { RepoEntityBase } from '@iappx/entity-repo'
import type { TResourceScopeCursor } from '@/application/services/resourceList/types/TResourceScopeCursor'

export type TResourceListState = {
    items: RepoEntityBase[]
    total?: number
    loading: boolean
    loaded: boolean
    error: string
    errorDetail: string
    forbidden: boolean
    busyKeys: string[]
    cursors: TResourceScopeCursor[]
    watching: boolean
    // 0 means the watch is live, not that it dropped at the epoch.
    staleSince: number
    flashKeys: string[]
}
