import { inject, injectable } from 'tsyringe'
import type { RepoEntityBase } from '@iappx/entity-repo'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import type { TDefaultClassCandidate } from '@/application/services/defaultClass/types/TDefaultClassCandidate'
import type { TDefaultClassPatch } from '@/application/services/defaultClass/types/TDefaultClassPatch'
import type { TDefaultClassPlan } from '@/application/services/defaultClass/types/TDefaultClassPlan'
import type { TDefaultClassTarget } from '@/application/services/defaultClass/types/TDefaultClassTarget'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import { IngressClassEntity } from '@/domain/entities/network'
import { StorageClassEntity } from '@/domain/entities/storage'
import { KubeDefaultClassCatalog } from '@/domain/models/kube'
import { KubeEntitySets } from '@/infrastructure/entityRepo/kube/KubeEntitySets'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'

@injectable()
export class DefaultClassService {
    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(ResourceListService) private readonly listService: ResourceListService,
    ) {}

    public static plan(
        target: TDefaultClassTarget,
        isDefault: boolean,
        classes: readonly TDefaultClassCandidate[],
    ): TDefaultClassPlan {
        const cleared = isDefault
            ? classes.filter(item => item.isDefault && item.name !== target.name).map(item => item.name)
            : []

        // Clearing goes first, in the order the Kubernetes docs give: before 1.26 an API server
        // with two defaults refuses every claim that names no class.
        return {
            target,
            isDefault,
            cleared,
            patches: [
                ...cleared.map(name => ({ name, isDefault: false })),
                { name: target.name, isDefault },
            ],
        }
    }

    public async prepare(target: TDefaultClassTarget, isDefault: boolean): Promise<TDefaultClassPlan> {
        if (!isDefault) {
            return DefaultClassService.plan(target, false, [])
        }

        const listed = await this.listService.list({ clusterId: target.clusterId, kind: target.kind })

        return DefaultClassService.plan(target, true, DefaultClassService.candidatesOf(listed.items))
    }

    public async apply(plan: TDefaultClassPlan): Promise<void> {
        for (const patch of plan.patches) {
            await this.write(plan.target, patch)
        }
    }

    private async write(target: TDefaultClassTarget, patch: TDefaultClassPatch): Promise<void> {
        const query = KubeEntitySets.queryFor(this.connectionService.context(target.clusterId), target.kind)

        const changes = query.entityConstructor.build({})
        changes.setDataValue('metadata', {
            annotations: { [KubeDefaultClassCatalog.annotationOf(target.kind)]: String(patch.isDefault) },
        })

        await query.withPathParams({ [KubeUrlBuilder.nameParam]: patch.name }).patch(changes)
    }

    private static candidatesOf(items: readonly RepoEntityBase[]): TDefaultClassCandidate[] {
        return items
            .filter((item): item is StorageClassEntity | IngressClassEntity => item instanceof StorageClassEntity
                || item instanceof IngressClassEntity)
            .map(item => ({ name: item.name, isDefault: item.isDefault }))
    }
}
