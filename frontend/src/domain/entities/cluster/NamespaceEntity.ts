import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TNamespacePhase } from '@/domain/entities/cluster/types/TNamespacePhase'
import type { TNamespaceSpec } from '@/domain/entities/cluster/types/TNamespaceSpec'
import type { TNamespaceStatus } from '@/domain/entities/cluster/types/TNamespaceStatus'

export class NamespaceEntity extends RepoEntityBase<NamespaceEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TNamespaceSpec

    @RepoEntityField({ isReadonly: true })
    status: TNamespaceStatus

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get phase(): TNamespacePhase | undefined {
        return this.status?.phase
    }

    get state(): TKubeObjectState {
        switch (this.phase) {
            case 'Active':
                return 'ok'
            case 'Terminating':
                return 'pending'
            default:
                return 'unknown'
        }
    }

    get isProblematic(): boolean {
        return false
    }
}
