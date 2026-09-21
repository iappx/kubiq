import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import { AccessModeCatalog } from '@/domain/entities/storage/AccessModeCatalog'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TPersistentVolumePhase } from '@/domain/entities/storage/types/TPersistentVolumePhase'
import type { TPersistentVolumeSpec } from '@/domain/entities/storage/types/TPersistentVolumeSpec'
import type { TPersistentVolumeStatus } from '@/domain/entities/storage/types/TPersistentVolumeStatus'

export class PersistentVolumeEntity extends RepoEntityBase<PersistentVolumeEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TPersistentVolumeSpec

    @RepoEntityField({ isReadonly: true })
    status: TPersistentVolumeStatus

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get phase(): TPersistentVolumePhase | undefined {
        return this.status?.phase
    }

    get capacity(): string {
        return this.spec?.capacity?.storage ?? ''
    }

    get storageClassName(): string {
        return this.spec?.storageClassName ?? ''
    }

    get reclaimPolicy(): string {
        return this.spec?.persistentVolumeReclaimPolicy ?? ''
    }

    get accessModes(): string[] {
        return this.spec?.accessModes ?? []
    }

    get accessModesText(): string {
        return this.accessModes.map(p => AccessModeCatalog.short(p)).join(', ')
    }

    get claimText(): string {
        const claim = this.spec?.claimRef
        if (!claim?.name) {
            return ''
        }
        return claim.namespace ? `${claim.namespace}/${claim.name}` : claim.name
    }

    // Released means the claim is gone but the data is still there, so it needs an operator's decision, not a healthy tick.
    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        switch (this.phase) {
            case 'Bound':
            case 'Available':
                return 'ok'
            case 'Pending':
                return 'pending'
            case 'Released':
                return 'warning'
            case 'Failed':
                return 'error'
            default:
                return 'unknown'
        }
    }

    get isProblematic(): boolean {
        return KubeObjectStateCatalog.isProblematic(this.state)
    }
}
