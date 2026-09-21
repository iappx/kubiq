import { RestUrlError } from '@iappx/entity-repo-rest'
import type { IUrlBuilder, TRestOperation } from '@iappx/entity-repo-rest'
import { KubeResourceKind } from '@/domain/models/kube'
import { KubeQueryMeta } from '@/infrastructure/entityRepo/kube/KubeQueryMeta'

export class KubeUrlBuilder implements IUrlBuilder {
    public static readonly namespaceParam: string = 'namespace'

    public static readonly nameParam: string = 'name'

    public static readonly subresourceParam: string = 'subresource'

    public build(operation: TRestOperation): string {
        const kind = KubeQueryMeta.kindOf(operation.meta)
        if (!kind) {
            throw new RestUrlError('The query carries no Kubernetes resource kind, so its path cannot be built')
        }

        const namespace = this.namespace(operation, kind)
        const path = operation.target === 'single'
            ? kind.objectPath(this.name(operation, kind), namespace)
            : kind.listPath(namespace)

        const subresource = KubeUrlBuilder.param(operation, KubeUrlBuilder.subresourceParam)

        return subresource ? `${path}/${subresource}` : path
    }

    protected namespace(operation: TRestOperation, kind: KubeResourceKind): string | undefined {
        if (!kind.namespaced) {
            return undefined
        }

        return KubeUrlBuilder.param(operation, KubeUrlBuilder.namespaceParam)
            ?? KubeUrlBuilder.metadata(operation, KubeUrlBuilder.namespaceParam)
    }

    protected name(operation: TRestOperation, kind: KubeResourceKind): string {
        const name = KubeUrlBuilder.param(operation, KubeUrlBuilder.nameParam)
            ?? KubeUrlBuilder.metadata(operation, KubeUrlBuilder.nameParam)
        if (!name) {
            throw new RestUrlError(
                `A single ${kind.kind} is addressed by name: pass withPathParams({ name }) or an object carrying metadata.name`,
            )
        }
        return name
    }

    protected static param(operation: TRestOperation, key: string): string | undefined {
        const value = operation.pathParams[key]
        return value === undefined || value === '' ? undefined : String(value)
    }

    protected static metadata(operation: TRestOperation, key: string): string | undefined {
        const payload = operation.payload as Record<string, unknown> | undefined
        const metadata = payload ? payload.metadata as Record<string, unknown> | undefined : undefined
        const value = metadata ? metadata[key] : undefined
        return typeof value === 'string' && value !== '' ? value : undefined
    }
}
