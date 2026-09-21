import { FilterFactory, QueryOperators } from '@iappx/entity-repo-query'
import type { TFilterNode } from '@iappx/entity-repo-query'
import type { TNamespacePhase } from '@/domain/entities/cluster/types/TNamespacePhase'

export class NamespaceFilters {
    public static withPhase<T>(filter: FilterFactory<T>, phase: TNamespacePhase): TFilterNode {
        return filter.opPath(QueryOperators.eq, ['status', 'phase'], phase)
    }

    public static active<T>(filter: FilterFactory<T>): TFilterNode {
        return NamespaceFilters.withPhase(filter, 'Active')
    }
}
