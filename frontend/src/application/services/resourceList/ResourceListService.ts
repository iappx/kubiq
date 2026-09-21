import { inject, injectable } from 'tsyringe'
import type { RepoEntityBase } from '@iappx/entity-repo'
import type { RestEntityQuery } from '@iappx/entity-repo-rest'
import type { TPage } from '@iappx/entity-repo-query'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { ResourceDeletePolicy } from '@/application/services/resourceList/constants/ResourceDeletePolicy'
import { ResourceListLimits } from '@/application/services/resourceList/constants/ResourceListLimits'
import type { TResourceListRequest } from '@/application/services/resourceList/types/TResourceListRequest'
import type { TResourceListResult } from '@/application/services/resourceList/types/TResourceListResult'
import type { TResourceScopeWatchRequest } from '@/application/services/resourceList/types/TResourceScopeWatchRequest'
import type { KubeResourceKind } from '@/domain/models/kube'
import { KubeApiParams } from '@/infrastructure/entityRepo/kube/KubeApiParams'
import { KubeEntitySets } from '@/infrastructure/entityRepo/kube/KubeEntitySets'
import { KubeObjectReader } from '@/infrastructure/entityRepo/kube/KubeObjectReader'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'
import type { IKubeWatchHandler } from '@/infrastructure/entityRepo/kube/transport/types/IKubeWatchHandler'
import type { IClusterStream } from '@/infrastructure/kube/types/IClusterStream'

@injectable()
export class ResourceListService {
    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
    ) {}

    public async list(request: TResourceListRequest): Promise<TResourceListResult> {
        const scopes = ResourceListService.scopes(request)
        const pages = await Promise.all(scopes.map(namespace => this.page(request, namespace)))

        return {
            items: pages.flatMap(page => page.items),
            total: ResourceListService.sumTotals(pages),
            cursors: pages.map((page, index) => ({
                namespace: scopes[index],
                resourceVersion: page.cursor?.start ?? '',
            })),
        }
    }

    public async watch(request: TResourceScopeWatchRequest, handler: IKubeWatchHandler): Promise<IClusterStream> {
        const stream = this.connectionService.stream(request.clusterId)
        const namespace = request.kind.namespaced ? request.namespace : ''

        const subscription = await stream.watch({
            path: request.kind.listPath(namespace),
            resourceVersion: request.resourceVersion,
            labelSelector: request.labelSelector,
            fieldSelector: request.fieldSelector,
        }, handler)

        const release = this.connectionService.registerStream(request.clusterId, subscription)

        return {
            stop: async () => {
                try {
                    await subscription.stop()
                } finally {
                    release()
                }
            },
        }
    }

    public toEntity(clusterId: string, kind: KubeResourceKind, object: Record<string, unknown>): RepoEntityBase {
        const query = this.query(clusterId, kind, '')

        return KubeObjectReader.toEntity(query.entityConstructor, object, kind)
    }

    public delete(clusterId: string, kind: KubeResourceKind, name: string, namespace: string): Promise<void> {
        return this.query(clusterId, kind, namespace)
            .withPathParams({ [KubeUrlBuilder.nameParam]: name })
            .withQueryParams({ [KubeApiParams.propagationPolicy]: ResourceDeletePolicy.applied })
            .delete(name)
    }

    // The API server scopes a list to one namespace or to all of them; a selection
    // of several is that many requests, never one request filtered afterwards.
    private static scopes(request: TResourceListRequest): string[] {
        const namespaces = request.kind.namespaced ? (request.namespaces ?? []) : []
        return namespaces.length > 0 ? [...namespaces] : ['']
    }

    private page(request: TResourceListRequest, namespace: string): Promise<TPage<RepoEntityBase>> {
        let query = this.query(request.clusterId, request.kind, namespace)
            .take(request.limit ?? ResourceListLimits.pageSize)

        if (request.labelSelector) {
            query = query.rawFilter({ [KubeApiParams.labelSelector]: request.labelSelector })
        }
        if (request.fieldSelector) {
            query = query.rawFilter({ [KubeApiParams.fieldSelector]: request.fieldSelector })
        }

        return query.getPage()
    }

    private query(clusterId: string, kind: KubeResourceKind, namespace: string): RestEntityQuery<RepoEntityBase> {
        return KubeEntitySets.queryFor(this.connectionService.context(clusterId), kind, namespace)
    }

    // A total is only honest when every scope reported one: a missing
    // remainingItemCount in one namespace would silently undercount the rest.
    private static sumTotals(pages: TPage<RepoEntityBase>[]): number | undefined {
        let total = 0
        for (const page of pages) {
            if (page.total === undefined) {
                return undefined
            }
            total += page.total
        }

        return total
    }
}
