import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { KubeConditions } from '@/domain/entities/kube/KubeConditions'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TJobSpec } from '@/domain/entities/workloads/types/TJobSpec'
import type { TJobStatus } from '@/domain/entities/workloads/types/TJobStatus'

export class JobEntity extends RepoEntityBase<JobEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TJobSpec

    @RepoEntityField({ isReadonly: true })
    status: TJobStatus

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get completions(): number {
        return this.spec?.completions ?? 1
    }

    get succeededCount(): number {
        return this.status?.succeeded ?? 0
    }

    get failedCount(): number {
        return this.status?.failed ?? 0
    }

    get activeCount(): number {
        return this.status?.active ?? 0
    }

    get readyText(): string {
        return `${this.succeededCount}/${this.completions}`
    }

    get isComplete(): boolean {
        return KubeConditions.isTrue(this.status?.conditions, 'Complete')
    }

    get isSuspended(): boolean {
        return this.spec?.suspend === true
    }

    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        if (KubeConditions.isTrue(this.status?.conditions, 'Failed')) {
            return 'error'
        }
        if (this.isComplete) {
            return 'ok'
        }
        if (this.failedCount > 0) {
            return 'warning'
        }
        return this.activeCount > 0 ? 'pending' : 'unknown'
    }

    get isProblematic(): boolean {
        return KubeObjectStateCatalog.isProblematic(this.state)
    }
}
