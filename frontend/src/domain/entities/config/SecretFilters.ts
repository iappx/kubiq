import { FilterFactory, QueryOperators } from '@iappx/entity-repo-query'
import type { TFilterNode } from '@iappx/entity-repo-query'

export class SecretFilters {
    public static ofType<T>(filter: FilterFactory<T>, type: string): TFilterNode {
        return filter.opPath(QueryOperators.eq, ['type'], type)
    }
}
