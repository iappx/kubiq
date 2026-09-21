import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TReplicationControllerSpec } from '@/domain/entities/workloads/types/TReplicationControllerSpec'
import type { TReplicationControllerStatus } from '@/domain/entities/workloads/types/TReplicationControllerStatus'

export class ReplicationControllerEntity extends RepoEntityBase<ReplicationControllerEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TReplicationControllerSpec

    @RepoEntityField({ isReadonly: true })
    status: TReplicationControllerStatus

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

    get currentReplicas(): number {
        return this.status?.replicas ?? 0
    }

    get readyReplicas(): number {
        return this.status?.readyReplicas ?? 0
    }

    get readyText(): string {
        return `${this.readyReplicas}/${this.desiredReplicas}`
    }

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
