import { UnsupportedOperationError } from '@iappx/entity-repo-query'
import type { TOrderNode } from '@iappx/entity-repo-query'
import type { IOrderEncoder, TCapabilitySlice, TEncodedQuery } from '@iappx/entity-repo-rest'

// Plugged in so the dialect does not fall back to FlatOrderEncoder, whose slice
// would let orderBy through and turn into a ?sort= the API server ignores.
export class KubeNoOrderEncoder implements IOrderEncoder {
    public readonly capabilities: TCapabilitySlice = { ordering: { multiple: false, nulls: false, byPath: false } }

    public encode(order: TOrderNode[]): TEncodedQuery {
        const paths = order.map(node => node.path.join('.')).join(', ')
        throw new UnsupportedOperationError(
            `The Kubernetes API returns a list in its own order, it cannot sort by "${paths}"`,
        )
    }
}
