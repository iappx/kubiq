import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { HorizontalPodAutoscalerConditionCatalog } from '@/domain/entities/config/HorizontalPodAutoscalerConditionCatalog'
import { KubeConditions } from '@/domain/entities/kube/KubeConditions'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import type { THorizontalPodAutoscalerSpec } from '@/domain/entities/config/types/THorizontalPodAutoscalerSpec'
import type { THorizontalPodAutoscalerStatus } from '@/domain/entities/config/types/THorizontalPodAutoscalerStatus'
import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'

export class HorizontalPodAutoscalerEntity extends RepoEntityBase<HorizontalPodAutoscalerEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: THorizontalPodAutoscalerSpec

    @RepoEntityField({ isReadonly: true })
    status: THorizontalPodAutoscalerStatus

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get targetText(): string {
        const target = this.spec?.scaleTargetRef
        return target?.kind && target?.name ? `${target.kind}/${target.name}` : ''
    }

    get minReplicas(): number {
        return this.spec?.minReplicas ?? 1
    }

    get maxReplicas(): number {
        return this.spec?.maxReplicas ?? 0
    }

    get currentReplicas(): number {
        return this.status?.currentReplicas ?? 0
    }

    get desiredReplicas(): number {
        return this.status?.desiredReplicas ?? 0
    }

    get replicaRange(): string {
        return `${this.minReplicas}–${this.maxReplicas}`
    }

    get metricCount(): number {
        return (this.spec?.metrics ?? []).length
    }

    get conditions(): TKubeCondition[] {
        return this.status?.conditions ?? []
    }

    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        if (this.conditions.length === 0) {
            return 'unknown'
        }
        if (KubeConditions.isFalse(this.conditions, HorizontalPodAutoscalerConditionCatalog.ableToScale)) {
            return 'error'
        }
        return KubeConditions.isFalse(this.conditions, HorizontalPodAutoscalerConditionCatalog.scalingActive)
            ? 'warning'
            : 'ok'
    }

    get isProblematic(): boolean {
        return KubeObjectStateCatalog.isProblematic(this.state)
    }
}
