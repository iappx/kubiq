import { RestResponseError } from '@iappx/entity-repo-rest'
import type { IResponseAdapter, TRequestContext, TRestResponse } from '@iappx/entity-repo-rest'
import type { TPageCursor } from '@iappx/entity-repo-query'
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

    // The API server reports what is left after this page, never a count, so a
    // list served without remainingItemCount has no total at all.
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

    public cursor(response: TRestResponse): TPageCursor | undefined {
        const data = response.data
        if (!data || typeof data !== 'object') {
            return undefined
        }

        const token = KubeListResponseAdapter.listMetadata(data)?.continue
        if (typeof token !== 'string') {
            return undefined
        }

        return token === '' ? { hasNext: false } : { end: token, hasNext: true }
    }

    protected decorateAll(items: Record<string, unknown>[], context: TRequestContext): Record<string, unknown>[] {
        return items.map(item => this.decorate(item, context))
    }

    // A list element carries neither its apiVersion and kind nor a flat key: the
    // uid lives under metadata and the type headers only on the list itself.
    protected decorate(item: Record<string, unknown>, context: TRequestContext): Record<string, unknown> {
        const kind = KubeQueryMeta.kindOf(context.meta)
        const metadata = item.metadata as Record<string, unknown> | undefined
        const decorated: Record<string, unknown> = { ...item }

        if (metadata && typeof metadata.uid === 'string') {
            decorated.uid = metadata.uid
        }
        if (kind && decorated.apiVersion === undefined) {
            decorated.apiVersion = kind.apiVersion
        }
        if (kind && decorated.kind === undefined) {
            decorated.kind = kind.kind
        }

        return decorated
    }

    protected static listMetadata(data: unknown): Record<string, unknown> | undefined {
        const metadata = (data as Record<string, unknown>).metadata
        return metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : undefined
    }
}
