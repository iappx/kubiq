import type { RepoEntityBase } from '@iappx/entity-repo'
import type { TResourceChangeType } from '@/application/services/resourceWatch/types/TResourceChangeType'

export type TResourceChange = {
    type: TResourceChangeType
    key: string
    entity: RepoEntityBase
}
