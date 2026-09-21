import { FilterFactory, QueryOperators } from '@iappx/entity-repo-query'
import type { TFilterNode } from '@iappx/entity-repo-query'
import type { TEventType } from '@/domain/entities/cluster/types/TEventType'

export class EventFilters {
    public static ofType<T>(filter: FilterFactory<T>, type: TEventType): TFilterNode {
        return filter.opPath(QueryOperators.eq, ['type'], type)
    }

    public static warnings<T>(filter: FilterFactory<T>): TFilterNode {
        return EventFilters.ofType(filter, 'Warning')
    }

    public static withReason<T>(filter: FilterFactory<T>, reason: string): TFilterNode {
        return filter.opPath(QueryOperators.eq, ['reason'], reason)
    }

    // The uid pins the events to one incarnation of the object: a rebuilt pod of
    // the same name keeps neither the uid nor the events of its predecessor.
    public static forObject<T>(filter: FilterFactory<T>, uid: string): TFilterNode {
        return filter.opPath(QueryOperators.eq, ['involvedObject', 'uid'], uid)
    }

    public static forObjectName<T>(filter: FilterFactory<T>, kind: string, name: string): TFilterNode {
        return filter.and(
            filter.opPath(QueryOperators.eq, ['involvedObject', 'kind'], kind),
            filter.opPath(QueryOperators.eq, ['involvedObject', 'name'], name),
        )
    }
}
