import type { TRelatedGroup } from '@/application/services/resourceDetail/types/TRelatedGroup'
import type { EventEntity } from '@/domain/entities/cluster'

export type TResourceObjectState = {
    loading: boolean
    loaded: boolean
    error: string
    errorDetail: string
    forbidden: boolean
    missing: boolean
    object: Record<string, unknown>
    relations: TRelatedGroup[]
    events: EventEntity[]
    eventsLoaded: boolean
    eventsError: string
    eventsWatching: boolean
    // 0 means the event watch is live, not that it dropped at the epoch.
    eventsStaleSince: number
    applying: boolean
    conflict: Record<string, unknown>
}
