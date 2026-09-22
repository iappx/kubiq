import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ArgoHealthStatusCatalog } from '@/domain/entities/argocd/ArgoHealthStatusCatalog'
import { ArgoOperationPhaseCatalog } from '@/domain/entities/argocd/ArgoOperationPhaseCatalog'
import { ArgoSyncStatusCatalog } from '@/domain/entities/argocd/ArgoSyncStatusCatalog'
import type { TArgoApplicationCondition } from '@/domain/entities/argocd/types/TArgoApplicationCondition'
import type { TArgoApplicationDestination } from '@/domain/entities/argocd/types/TArgoApplicationDestination'
import type { TArgoApplicationSource } from '@/domain/entities/argocd/types/TArgoApplicationSource'
import type { TArgoApplicationSpec } from '@/domain/entities/argocd/types/TArgoApplicationSpec'
import type { TArgoApplicationStatus } from '@/domain/entities/argocd/types/TArgoApplicationStatus'
import type { TArgoHealthStatus } from '@/domain/entities/argocd/types/TArgoHealthStatus'
import type { TArgoOperation } from '@/domain/entities/argocd/types/TArgoOperation'
import type { TArgoOperationPhase } from '@/domain/entities/argocd/types/TArgoOperationPhase'
import type { TArgoResourceStatus } from '@/domain/entities/argocd/types/TArgoResourceStatus'
import type { TArgoRevisionHistory } from '@/domain/entities/argocd/types/TArgoRevisionHistory'
import type { TArgoSyncStatus } from '@/domain/entities/argocd/types/TArgoSyncStatus'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'

export class ArgoApplicationEntity extends RepoEntityBase<ArgoApplicationEntity> {
    public static readonly defaultProject: string = 'default'

    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TArgoApplicationSpec

    @RepoEntityField()
    status: TArgoApplicationStatus

    // The controller reads a sync request off this top-level field; it is written, never read back as state.
    @RepoEntityField()
    operation: TArgoOperation

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get project(): string {
        return this.spec?.project ?? ArgoApplicationEntity.defaultProject
    }

    get destination(): TArgoApplicationDestination {
        return this.spec?.destination ?? {}
    }

    get destinationNamespace(): string {
        return this.destination.namespace ?? ''
    }

    get destinationCluster(): string {
        return this.destination.name ?? this.destination.server ?? ''
    }

    // Multi-source applications keep the list in `sources`; the first one is what the list column can show.
    get source(): TArgoApplicationSource {
        return this.spec?.source ?? this.spec?.sources?.[0] ?? {}
    }

    get sources(): TArgoApplicationSource[] {
        const declared = this.spec?.sources ?? []

        return declared.length > 0 ? declared : (this.spec?.source ? [this.spec.source] : [])
    }

    get repoUrl(): string {
        return this.source.repoURL ?? ''
    }

    get targetRevision(): string {
        return this.source.targetRevision ?? ''
    }

    get sourceText(): string {
        const source = this.source

        return source.chart ? source.chart : (source.path ?? '')
    }

    get syncStatus(): TArgoSyncStatus {
        return ArgoSyncStatusCatalog.read(this.status?.sync?.status)
    }

    get healthStatus(): TArgoHealthStatus {
        return ArgoHealthStatusCatalog.read(this.status?.health?.status)
    }

    get healthMessage(): string {
        return this.status?.health?.message ?? ''
    }

    get syncedRevision(): string {
        return this.status?.sync?.revision ?? ''
    }

    get conditions(): TArgoApplicationCondition[] {
        return this.status?.conditions ?? []
    }

    get resources(): TArgoResourceStatus[] {
        return this.status?.resources ?? []
    }

    get history(): TArgoRevisionHistory[] {
        return this.status?.history ?? []
    }

    get operationPhase(): TArgoOperationPhase | undefined {
        return ArgoOperationPhaseCatalog.read(this.status?.operationState?.phase)
    }

    get operationMessage(): string {
        return this.status?.operationState?.message ?? ''
    }

    get isOperationRunning(): boolean {
        return ArgoOperationPhaseCatalog.isLive(this.operationPhase)
    }

    get isAutoSync(): boolean {
        return this.spec?.syncPolicy?.automated !== undefined && this.spec.syncPolicy.automated !== null
    }

    get isSelfHealing(): boolean {
        return this.spec?.syncPolicy?.automated?.selfHeal === true
    }

    get isAutoPruning(): boolean {
        return this.spec?.syncPolicy?.automated?.prune === true
    }

    get syncPolicyText(): string {
        if (!this.isAutoSync) {
            return 'Manual'
        }

        const extras = [
            this.isAutoPruning ? 'prune' : '',
            this.isSelfHealing ? 'self-heal' : '',
        ].filter(flag => flag !== '')

        return extras.length > 0 ? `Automated (${extras.join(', ')})` : 'Automated'
    }

    // Health decides before sync: an application can be perfectly healthy while the
    // repository it tracks has moved on, and that is a warning, not a failure.
    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        if (this.healthStatus === 'Degraded' || this.healthStatus === 'Missing') {
            return 'error'
        }
        if (this.healthStatus === 'Progressing' || this.isOperationRunning) {
            return 'pending'
        }
        if (this.healthStatus === 'Unknown') {
            return 'unknown'
        }
        if (this.syncStatus === 'OutOfSync') {
            return 'warning'
        }

        return this.healthStatus === 'Healthy' ? 'ok' : 'unknown'
    }

    get isProblematic(): boolean {
        return this.state === 'warning' || this.state === 'error'
    }
}
