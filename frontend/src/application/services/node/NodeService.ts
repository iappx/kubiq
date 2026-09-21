import { inject, injectable } from 'tsyringe'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import { NodeDrainLimits } from '@/application/services/node/constants/NodeDrainLimits'
import type { TNodeDrainFailure } from '@/application/services/node/types/TNodeDrainFailure'
import type { TNodeDrainRequest } from '@/application/services/node/types/TNodeDrainRequest'
import type { TNodeDrainResult } from '@/application/services/node/types/TNodeDrainResult'
import type { TNodePodsRequest } from '@/application/services/node/types/TNodePodsRequest'
import type { TNodeTarget } from '@/application/services/node/types/TNodeTarget'
import { NodeDrainPolicy } from '@/domain/entities/cluster'
import { PodEntity, PodFilters } from '@/domain/entities/workloads'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeEntitySets } from '@/infrastructure/entityRepo/kube/KubeEntitySets'
import { KubeSelectorCompiler } from '@/infrastructure/entityRepo/kube/KubeSelectorCompiler'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'

@injectable()
export class NodeService {
    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(ResourceListService) private readonly listService: ResourceListService,
    ) {}

    public cordon(target: TNodeTarget): Promise<void> {
        return this.setSchedulable(target, false)
    }

    public uncordon(target: TNodeTarget): Promise<void> {
        return this.setSchedulable(target, true)
    }

    public async podsOn(request: TNodePodsRequest): Promise<PodEntity[]> {
        const selectors = KubeSelectorCompiler.compile(
            this.connectionService.context(request.clusterId),
            request.podsKind,
            filter => PodFilters.onNode(filter, request.nodeName),
        )

        const result = await this.listService.list({
            clusterId: request.clusterId,
            kind: request.podsKind,
            fieldSelector: selectors.fieldSelector,
            limit: NodeDrainLimits.maxPods,
        })

        return result.items.filter((item): item is PodEntity => item instanceof PodEntity)
    }

    // Cordon first, exactly as kubectl drain does: without it the scheduler puts new pods
    // onto the node while the old ones are still being evicted.
    public async drain(request: TNodeDrainRequest): Promise<TNodeDrainResult> {
        await this.cordon(request.target)

        const pods = await this.podsOn({
            clusterId: request.target.clusterId,
            podsKind: request.podsKind,
            nodeName: request.target.name,
        })

        const evictable = NodeDrainPolicy.evictable(pods)
        const failures: TNodeDrainFailure[] = []
        let evicted = 0

        // Sequential on purpose: a parallel burst of evictions is what makes a
        // PodDisruptionBudget reject most of them at once.
        for (const pod of evictable) {
            try {
                await this.evict(request, pod)
                evicted++
            } catch (err) {
                failures.push({
                    name: pod.name,
                    namespace: pod.namespace,
                    message: err instanceof ApiError ? err.message : 'The eviction was refused',
                })
            }
        }

        return { evicted, skipped: pods.length - evictable.length, failures }
    }

    private setSchedulable(target: TNodeTarget, schedulable: boolean): Promise<void> {
        const query = KubeEntitySets.queryFor(this.connectionService.context(target.clusterId), target.kind)
        const changes = query.entityConstructor.build({})
        changes.setDataValue('spec', { unschedulable: !schedulable })

        return query
            .withPathParams({ [KubeUrlBuilder.nameParam]: target.name })
            .patch(changes)
            .then(() => undefined)
    }

    // An Eviction is a subresource write of the pod, so it is addressed and serialised
    // through the pods set — there is no Eviction collection to own an entity set of its own.
    private async evict(request: TNodeDrainRequest, pod: PodEntity): Promise<void> {
        const query = KubeEntitySets.queryFor(
            this.connectionService.context(request.target.clusterId),
            request.podsKind,
            pod.namespace,
        )

        const eviction = query.entityConstructor.build({})
        eviction.setDataValue('apiVersion', NodeDrainLimits.evictionApiVersion)
        eviction.setDataValue('kind', NodeDrainLimits.evictionKind)
        eviction.setDataValue('metadata', { name: pod.name, namespace: pod.namespace })

        await query
            .withPathParams({
                [KubeUrlBuilder.nameParam]: pod.name,
                [KubeUrlBuilder.subresourceParam]: NodeDrainLimits.evictionSubresource,
            })
            .create(eviction)
    }
}
