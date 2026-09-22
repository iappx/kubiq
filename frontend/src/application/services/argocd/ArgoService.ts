import { inject, injectable } from 'tsyringe'
import type { RepoEntityBase } from '@iappx/entity-repo'
import type { RestEntityQuery } from '@iappx/entity-repo-rest'
import { ArgoLimits } from '@/application/services/argocd/constants/ArgoLimits'
import type { TArgoApplicationTarget } from '@/application/services/argocd/types/TArgoApplicationTarget'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import type { ArgoApplicationEntity } from '@/domain/entities/argocd/ArgoApplicationEntity'
import type { ArgoApplicationSetEntity } from '@/domain/entities/argocd/ArgoApplicationSetEntity'
import type { ArgoAppProjectEntity } from '@/domain/entities/argocd/ArgoAppProjectEntity'
import type { TArgoApplicationSource } from '@/domain/entities/argocd/types/TArgoApplicationSource'
import type { TArgoAutomatedSyncPolicy } from '@/domain/entities/argocd/types/TArgoAutomatedSyncPolicy'
import type { TArgoSyncDraft } from '@/domain/entities/argocd/types/TArgoSyncDraft'
import { ArgoAnnotations, ArgoFinalizers, ArgoOperationBuilder } from '@/domain/models/argocd'
import type { KubeResourceKind } from '@/domain/models/kube'
import { KubeEntitySets } from '@/infrastructure/entityRepo/kube/KubeEntitySets'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'

@injectable()
export class ArgoService {
    public static readonly terminatingPhase: string = 'Terminating'

    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
    ) {}

    public listApplications(clusterId: string, kind: KubeResourceKind): Promise<ArgoApplicationEntity[]> {
        return this.list<ArgoApplicationEntity>(clusterId, kind)
    }

    public listProjects(clusterId: string, kind: KubeResourceKind): Promise<ArgoAppProjectEntity[]> {
        return this.list<ArgoAppProjectEntity>(clusterId, kind)
    }

    public listApplicationSets(clusterId: string, kind: KubeResourceKind): Promise<ArgoApplicationSetEntity[]> {
        return this.list<ArgoApplicationSetEntity>(clusterId, kind)
    }

    public async sync(
        target: TArgoApplicationTarget,
        draft: TArgoSyncDraft,
        source?: TArgoApplicationSource,
    ): Promise<void> {
        await this.patch(target, 'operation', ArgoOperationBuilder.sync(draft, source))
    }

    public async refresh(target: TArgoApplicationTarget, hard: boolean): Promise<void> {
        await this.patch(target, 'metadata', {
            annotations: { [ArgoAnnotations.refresh]: ArgoAnnotations.refreshValue(hard) },
        })
    }

    // The Application CRD declares no status subresource, which is what makes the phase
    // writable from here at all — the Argo CD server terminates an operation the same way.
    public async terminate(target: TArgoApplicationTarget): Promise<void> {
        await this.patch(target, 'status', {
            operationState: { phase: ArgoService.terminatingPhase },
        })
    }

    public async setAutomatedSync(
        target: TArgoApplicationTarget,
        automated: TArgoAutomatedSyncPolicy | null,
    ): Promise<void> {
        await this.patch(target, 'spec', { syncPolicy: { automated } })
    }

    public async remove(
        target: TArgoApplicationTarget,
        cascade: boolean,
        finalizers: readonly string[],
    ): Promise<void> {
        const desired = ArgoFinalizers.desired(finalizers, cascade)
        if (!ArgoFinalizers.same(finalizers, desired)) {
            await this.patch(target, 'metadata', { finalizers: desired })
        }

        await this.query(target.clusterId, target.kind, target.namespace)
            .withPathParams({ [KubeUrlBuilder.nameParam]: target.name })
            .delete(target.name)
    }

    // Applications are a cluster-wide control plane: the operator's namespace scope says which
    // workloads to look at, not which Argo CD objects exist.
    private async list<T extends RepoEntityBase>(clusterId: string, kind: KubeResourceKind): Promise<T[]> {
        const page = await this.query(clusterId, kind, '')
            .take(ArgoLimits.pageSize)
            .getPage()

        return page.items as T[]
    }

    // A fresh entity carrying only the changed field: patching a loaded one would merge its
    // whole spec back and undo anything the controller wrote in between.
    private patch(target: TArgoApplicationTarget, field: string, value: Record<string, unknown>): Promise<RepoEntityBase> {
        const query = this.query(target.clusterId, target.kind, target.namespace)
        const changes = query.entityConstructor.build({})
        changes.setDataValue(field, value)

        return query.withPathParams({ [KubeUrlBuilder.nameParam]: target.name }).patch(changes)
    }

    private query(clusterId: string, kind: KubeResourceKind, namespace: string): RestEntityQuery<RepoEntityBase> {
        return KubeEntitySets.queryFor(this.connectionService.context(clusterId), kind, namespace)
    }
}
