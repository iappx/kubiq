import { UnsupportedOperationError } from '@iappx/entity-repo-query'
import type { TPagingNode } from '@iappx/entity-repo-query'
import { EncodedQueryMerger } from '@iappx/entity-repo-rest'
import type { IPagingEncoder, TCapabilitySlice, TEncodedQuery, TRestQueryParams } from '@iappx/entity-repo-rest'
import { KubeApiParams } from '@/infrastructure/entityRepo/kube/KubeApiParams'

export class KubeContinuePagingEncoder implements IPagingEncoder {
    public readonly capabilities: TCapabilitySlice = { paging: ['cursor'] }

    public encode(paging: TPagingNode): TEncodedQuery {
        if (paging.kind !== 'cursor') {
            throw new UnsupportedOperationError(
                `The Kubernetes API pages with a continue token, it has no ${paging.kind} paging`,
            )
        }
        if (paging.last !== undefined || paging.before !== undefined) {
            throw new UnsupportedOperationError('A Kubernetes list can only be paged forwards')
        }

        const params: TRestQueryParams = {}
        if (paging.first !== undefined) {
            params[KubeApiParams.limit] = paging.first
        }
        if (paging.after !== undefined && paging.after !== '') {
            params[KubeApiParams.continueToken] = paging.after
        }

        return Object.keys(params).length > 0 ? { params } : EncodedQueryMerger.empty()
    }
}
