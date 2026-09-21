import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TReplicaSetSpec } from '@/domain/entities/workloads/types/TReplicaSetSpec'
import type { TReplicaSetStatus } from '@/domain/entities/workloads/types/TReplicaSetStatus'

export class ReplicaSetEntity extends RepoEntityBase<ReplicaSetEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TReplicaSetSpec

    @RepoEntityField({ isReadonly: true })
    status: TReplicaSetStatus

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get desiredReplicas(): number {
        return this.spec?.replicas ?? 1
    }

    get readyReplicas(): number {
        return this.status?.readyReplicas ?? 0
    }

    get readyText(): string {
        return `${this.readyReplicas}/${this.desiredReplicas}`
    }

    // A deployment keeps its superseded replica sets scaled to zero, which is the normal state of a healthy cluster.
    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        if (this.desiredReplicas === 0) {
            return 'ok'
        }
        if (this.readyReplicas === 0) {
            return 'error'
        }
        return this.readyReplicas < this.desiredReplicas ? 'warning' : 'ok'
    }

    get isProblematic(): boolean {
        return KubeObjectStateCatalog.isProblematic(this.state)
    }
}
