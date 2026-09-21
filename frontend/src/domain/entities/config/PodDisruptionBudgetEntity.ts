import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TPodDisruptionBudgetSpec } from '@/domain/entities/config/types/TPodDisruptionBudgetSpec'
import type { TPodDisruptionBudgetStatus } from '@/domain/entities/config/types/TPodDisruptionBudgetStatus'

export class PodDisruptionBudgetEntity extends RepoEntityBase<PodDisruptionBudgetEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TPodDisruptionBudgetSpec

    @RepoEntityField({ isReadonly: true })
    status: TPodDisruptionBudgetStatus

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get minAvailableText(): string {
        const value = this.spec?.minAvailable
        return value === undefined ? '' : String(value)
    }

    get maxUnavailableText(): string {
        const value = this.spec?.maxUnavailable
        return value === undefined ? '' : String(value)
    }

    get currentHealthy(): number {
        return this.status?.currentHealthy ?? 0
    }

    get desiredHealthy(): number {
        return this.status?.desiredHealthy ?? 0
    }

    get disruptionsAllowed(): number {
        return this.status?.disruptionsAllowed ?? 0
    }

    // A budget with no status yet has not been evaluated; saying "0 healthy" would read as an outage.
    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        if (this.status?.currentHealthy === undefined) {
            return 'unknown'
        }
        return this.currentHealthy >= this.desiredHealthy ? 'ok' : 'warning'
    }

    get isProblematic(): boolean {
        return KubeObjectStateCatalog.isProblematic(this.state)
    }
}
