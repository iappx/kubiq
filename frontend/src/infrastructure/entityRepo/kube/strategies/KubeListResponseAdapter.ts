import { RestResponseError } from '@iappx/entity-repo-rest'
import type { IResponseAdapter, TRequestContext, TRestResponse } from '@iappx/entity-repo-rest'
import type { TPageCursor } from '@iappx/entity-repo-query'
import { KubeObjectReader } from '@/infrastructure/entityRepo/kube/KubeObjectReader'
import { KubeQueryMeta } from '@/infrastructure/entityRepo/kube/KubeQueryMeta'

export class KubeListResponseAdapter implements IResponseAdapter {
    public items(response: TRestResponse, context: TRequestContext): Record<string, unknown>[] {
        const data = response.data
        if (data === undefined || data === null) {
            return []
        }
        if (Array.isArray(data)) {
            return this.decorateAll(data as Record<string, unknown>[], context)
        }

        const items = (data as Record<string, unknown>).items
        if (!Array.isArray(items)) {
            throw new RestResponseError(`${context.url} did not answer with a Kubernetes list`, data)
        }

        return this.decorateAll(items as Record<string, unknown>[], context)
    }

    public single(response: TRestResponse, context: TRequestContext): Record<string, unknown> | undefined {
        const data = response.data
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return undefined
        }
        return this.decorate(data as Record<string, unknown>, context)
    }

    // The API server reports what is left after this page, never a count, so without
    // remainingItemCount there is no total at all.
    public total(response: TRestResponse): number | undefined {
        const data = response.data
        if (!data || typeof data !== 'object') {
            return undefined
        }

        const items = (data as Record<string, unknown>).items
        const remaining = KubeListResponseAdapter.listMetadata(data)?.remainingItemCount
        if (!Array.isArray(items) || typeof remaining !== 'number') {
            return undefined
        }

        return items.length + remaining
    }

    // Both slots of TPageCursor are in use: `end` is the continue token of the next
    // page, `start` the resourceVersion the page was read at — where a watch resumes.
    public cursor(response: TRestResponse): TPageCursor | undefined {
        const data = response.data
        if (!data || typeof data !== 'object') {
            return undefined
        }

        const metadata = KubeListResponseAdapter.listMetadata(data)
        const token = metadata?.continue
        const version = metadata?.resourceVersion
        const cursor: TPageCursor = {}

        if (typeof version === 'string' && version !== '') {
            cursor.start = version
        }
        if (typeof token === 'string') {
            cursor.hasNext = token !== ''
            if (token !== '') {
                cursor.end = token
            }
        }

        return Object.keys(cursor).length > 0 ? cursor : undefined
    }

    protected decorateAll(items: Record<string, unknown>[], context: TRequestContext): Record<string, unknown>[] {
        return items.map(item => this.decorate(item, context))
    }

    protected decorate(item: Record<string, unknown>, context: TRequestContext): Record<string, unknown> {
        return KubeObjectReader.decorate(item, KubeQueryMeta.kindOf(context.meta))
    }

    protected static listMetadata(data: unknown): Record<string, unknown> | undefined {
        const metadata = (data as Record<string, unknown>).metadata
        return metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : undefined
    }
}
