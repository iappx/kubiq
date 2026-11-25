import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { KubeConditions } from '@/domain/entities/kube/KubeConditions'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TDeploymentSpec } from '@/domain/entities/workloads/types/TDeploymentSpec'
import type { TDeploymentStatus } from '@/domain/entities/workloads/types/TDeploymentStatus'

export class DeploymentEntity extends RepoEntityBase<DeploymentEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TDeploymentSpec

    @RepoEntityField({ isReadonly: true })
    status: TDeploymentStatus

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    // The API server defaults a missing spec.replicas to 1, not to 0.
    get desiredReplicas(): number {
        return this.spec?.replicas ?? 1
    }

    get readyReplicas(): number {
        return this.status?.readyReplicas ?? 0
    }

    get updatedReplicas(): number {
        return this.status?.updatedReplicas ?? 0
    }

    get availableReplicas(): number {
        return this.status?.availableReplicas ?? 0
    }

    get readyText(): string {
        return `${this.readyReplicas}/${this.desiredReplicas}`
    }

    get isPaused(): boolean {
        return this.spec?.paused === true
    }

    get isProgressing(): boolean {
        if (this.isPaused) {
            return false
        }
        const conditions = this.status?.conditions
        if (KubeConditions.isFalse(conditions, 'Progressing')) {
            return false
        }
        const generation = this.metadata?.generation
        const observed = this.status?.observedGeneration
        if (generation !== undefined && observed !== undefined && observed < generation) {
            return true
        }
        if (!KubeConditions.isTrue(conditions, 'Progressing')) {
            return false
        }
        const reason = KubeConditions.reason(conditions, 'Progressing')
        if (reason === 'NewReplicaSetAvailable') {
            return false
        }
        if (reason) {
            return true
        }
        return this.updatedReplicas < this.desiredReplicas
            || this.availableReplicas < this.desiredReplicas
    }

    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        const conditions = this.status?.conditions
        if (KubeConditions.isFalse(conditions, 'Progressing')) {
            return 'error'
        }
        if (this.desiredReplicas === 0) {
            return 'ok'
        }
        if (this.isProgressing) {
            return 'pending'
        }
        if (this.readyReplicas === 0) {
            return 'error'
        }
        return this.readyReplicas < this.desiredReplicas ? 'warning' : 'ok'
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
