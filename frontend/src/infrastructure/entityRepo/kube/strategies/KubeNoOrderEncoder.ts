import { UnsupportedOperationError } from '@iappx/entity-repo-query'
import type { TOrderNode } from '@iappx/entity-repo-query'
import type { IOrderEncoder, TCapabilitySlice, TEncodedQuery } from '@iappx/entity-repo-rest'

// Without it the dialect falls back to FlatOrderEncoder, and orderBy would compile
// into a ?sort= the API server ignores.
export class KubeNoOrderEncoder implements IOrderEncoder {
    public readonly capabilities: TCapabilitySlice = { ordering: { multiple: false, nulls: false, byPath: false } }

    public encode(order: TOrderNode[]): TEncodedQuery {
        const paths = order.map(node => node.path.join('.')).join(', ')
        throw new UnsupportedOperationError(
            `The Kubernetes API returns a list in its own order, it cannot sort by "${paths}"`,
        )
    }
}
