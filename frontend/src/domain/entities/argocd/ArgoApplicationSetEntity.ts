import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import type { TArgoApplicationSetSpec } from '@/domain/entities/argocd/types/TArgoApplicationSetSpec'
import type { TArgoApplicationSetStatus } from '@/domain/entities/argocd/types/TArgoApplicationSetStatus'
import { KubeConditions } from '@/domain/entities/kube/KubeConditions'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'

export class ArgoApplicationSetEntity extends RepoEntityBase<ArgoApplicationSetEntity> {
    public static readonly errorCondition: string = 'ErrorOccurred'

    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TArgoApplicationSetSpec

    @RepoEntityField({ isReadonly: true })
    status: TArgoApplicationSetStatus

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
        return this.spec?.template?.spec?.project ?? ''
    }

    get strategy(): string {
        return this.spec?.strategy?.type ?? 'AllAtOnce'
    }

    get conditions(): TKubeCondition[] {
        return this.status?.conditions ?? []
    }

    get generatorKinds(): string[] {
        return (this.spec?.generators ?? []).flatMap(generator => Object.keys(generator))
    }

    get generatorsText(): string {
        return this.generatorKinds.join(', ')
    }

    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        if (KubeConditions.isTrue(this.conditions, ArgoApplicationSetEntity.errorCondition)) {
            return 'error'
        }

        return this.conditions.length === 0 ? 'unknown' : 'ok'
    }

    get isProblematic(): boolean {
        return this.state === 'error'
    }
}
