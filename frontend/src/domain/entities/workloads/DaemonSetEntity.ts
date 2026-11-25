import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TDaemonSetSpec } from '@/domain/entities/workloads/types/TDaemonSetSpec'
import type { TDaemonSetStatus } from '@/domain/entities/workloads/types/TDaemonSetStatus'

export class DaemonSetEntity extends RepoEntityBase<DaemonSetEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TDaemonSetSpec

    @RepoEntityField({ isReadonly: true })
    status: TDaemonSetStatus

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get desiredCount(): number {
        return this.status?.desiredNumberScheduled ?? 0
    }

    get readyCount(): number {
        return this.status?.numberReady ?? 0
    }

    get misscheduledCount(): number {
        return this.status?.numberMisscheduled ?? 0
    }

    get readyText(): string {
        return `${this.readyCount}/${this.desiredCount}`
    }

    get isProgressing(): boolean {
        const generation = this.metadata?.generation
        const observed = this.status?.observedGeneration
        if (generation !== undefined && observed !== undefined && observed < generation) {
            return true
        }
        return this.desiredCount > 0
            && this.status?.updatedNumberScheduled !== undefined
            && this.status.updatedNumberScheduled < this.desiredCount
    }

    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        if (this.misscheduledCount > 0) {
            return 'warning'
        }
        if (this.desiredCount === 0) {
            return 'ok'
        }
        if (this.isProgressing) {
            return 'pending'
        }
        if (this.readyCount === 0) {
            return 'error'
        }
        return this.readyCount < this.desiredCount ? 'warning' : 'ok'
    }

    get stateLabel(): string {
        if (this.metadata?.isDeleting) {
            return 'Terminating'
        }
        if (this.state === 'pending' && this.isProgressing) {
            return 'Progressing'
        }
        return KubeObjectStateCatalog.title(this.state)
    }

    get isProblematic(): boolean {
        return KubeObjectStateCatalog.isProblematic(this.state)
    }
}
