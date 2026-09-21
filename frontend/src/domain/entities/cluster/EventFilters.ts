import { FilterFactory, QueryOperators } from '@iappx/entity-repo-query'
import type { TFilterNode } from '@iappx/entity-repo-query'
import type { TEventScope } from '@/domain/entities/cluster/types/TEventScope'
import type { TEventType } from '@/domain/entities/cluster/types/TEventType'

export class EventFilters {
    public static ofType<T>(filter: FilterFactory<T>, type: TEventType): TFilterNode {
        return filter.opPath(QueryOperators.eq, ['type'], type)
    }

    public static forKind<T>(filter: FilterFactory<T>, kind: string): TFilterNode {
        return filter.opPath(QueryOperators.eq, ['involvedObject', 'kind'], kind)
    }

    public static forName<T>(filter: FilterFactory<T>, name: string): TFilterNode {
        return filter.opPath(QueryOperators.eq, ['involvedObject', 'name'], name)
    }

    public static isScoped(scope: TEventScope): boolean {
        return scope.type !== '' || scope.objectKind !== '' || scope.objectName !== ''
    }

    public static forScope<T>(filter: FilterFactory<T>, scope: TEventScope): TFilterNode {
        const parts: TFilterNode[] = []
        if (scope.type !== '') {
            parts.push(EventFilters.ofType(filter, scope.type))
        }
        if (scope.objectKind !== '') {
            parts.push(EventFilters.forKind(filter, scope.objectKind))
        }
        if (scope.objectName !== '') {
            parts.push(EventFilters.forName(filter, scope.objectName))
        }

        return parts.length === 1 ? parts[0] : filter.and(...parts)
    }

    public static warnings<T>(filter: FilterFactory<T>): TFilterNode {
        return EventFilters.ofType(filter, 'Warning')
    }

    public static withReason<T>(filter: FilterFactory<T>, reason: string): TFilterNode {
        return filter.opPath(QueryOperators.eq, ['reason'], reason)
    }

    // A rebuilt pod of the same name keeps neither the uid nor the events of its predecessor.
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
