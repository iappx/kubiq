import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { KubeConditions } from '@/domain/entities/kube/KubeConditions'
import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'

export class CustomResourceEntity extends RepoEntityBase<CustomResourceEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: Record<string, unknown>

    @RepoEntityField()
    status: Record<string, unknown>

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get conditions(): TKubeCondition[] {
        const conditions = this.status?.conditions
        return Array.isArray(conditions) ? conditions as TKubeCondition[] : []
    }

    // A CRD author may omit status.conditions or spell readiness their own way, so a missing Ready is unknown, not an error.
    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        const conditions = this.conditions
        if (KubeConditions.find(conditions, 'Ready') === undefined) {
            return 'unknown'
        }
        return KubeConditions.isTrue(conditions, 'Ready') ? 'ok' : 'error'
    }

    get isProblematic(): boolean {
        return this.state === 'error'
    }
}
