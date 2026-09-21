import type { TRestQueryOptions } from '@iappx/entity-repo-rest'
import { KubeResourceKind, KubeResourceRegistry } from '@/domain/models/kube'
import { KubeQueryMeta } from '@/infrastructure/entityRepo/kube/KubeQueryMeta'
import { KubeContinuePagingEncoder } from '@/infrastructure/entityRepo/kube/strategies/KubeContinuePagingEncoder'
import { KubeListResponseAdapter } from '@/infrastructure/entityRepo/kube/strategies/KubeListResponseAdapter'
import { KubeNoOrderEncoder } from '@/infrastructure/entityRepo/kube/strategies/KubeNoOrderEncoder'
import { KubeNoSelectionEncoder } from '@/infrastructure/entityRepo/kube/strategies/KubeNoSelectionEncoder'
import { KubePatchRequestFactory } from '@/infrastructure/entityRepo/kube/strategies/KubePatchRequestFactory'
import { KubeSelectorFilterEncoder } from '@/infrastructure/entityRepo/kube/strategies/KubeSelectorFilterEncoder'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'

export class KubeEntitySetOptions {
    public static readonly dialect: string = 'KubeDialect'

    public static generic(): TRestQueryOptions {
        return {
            dialect: KubeEntitySetOptions.dialect,
            pagingKind: 'cursor',
            filterEncoder: new KubeSelectorFilterEncoder(),
            orderEncoder: new KubeNoOrderEncoder(),
            pagingEncoder: new KubeContinuePagingEncoder(),
            selectionEncoder: new KubeNoSelectionEncoder(),
            urlBuilder: new KubeUrlBuilder(),
            requestFactory: new KubePatchRequestFactory(),
            responseAdapter: new KubeListResponseAdapter(),
        }
    }

    public static forKind(kind: KubeResourceKind): TRestQueryOptions {
        return { ...KubeEntitySetOptions.generic(), meta: KubeQueryMeta.forKind(kind) }
    }

    public static forResource(group: string, resource: string): TRestQueryOptions {
        const kind = KubeResourceRegistry.find(group, resource)
        if (!kind) {
            throw new Error(`Unknown Kubernetes resource "${KubeResourceKind.registryKeyOf(group, resource)}"`)
        }
        return KubeEntitySetOptions.forKind(kind)
    }
}
