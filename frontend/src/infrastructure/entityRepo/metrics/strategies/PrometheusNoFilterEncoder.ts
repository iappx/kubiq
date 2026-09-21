import { UnsupportedOperationError } from '@iappx/entity-repo-query'
import type { IFilterEncoder, TCapabilitySlice, TEncodedQuery } from '@iappx/entity-repo-rest'

// Prometheus selects with PromQL, not with a filter AST: declaring no operators makes
// QueryValidator refuse a where() before anything is sent through the proxy.
export class PrometheusNoFilterEncoder implements IFilterEncoder {
    public readonly capabilities: TCapabilitySlice = {
        operators: [],
        logical: { or: false, not: false, nesting: false },
        relationFilters: { enabled: false, quantifiers: [] },
        raw: false,
    }

    public encode(): TEncodedQuery {
        throw new UnsupportedOperationError('A Prometheus series is selected by its PromQL expression, not by a filter')
    }
}
