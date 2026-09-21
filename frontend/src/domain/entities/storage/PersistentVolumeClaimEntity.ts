import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import { AccessModeCatalog } from '@/domain/entities/storage/AccessModeCatalog'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TPersistentVolumeClaimPhase } from '@/domain/entities/storage/types/TPersistentVolumeClaimPhase'
import type { TPersistentVolumeClaimSpec } from '@/domain/entities/storage/types/TPersistentVolumeClaimSpec'
import type { TPersistentVolumeClaimStatus } from '@/domain/entities/storage/types/TPersistentVolumeClaimStatus'

export class PersistentVolumeClaimEntity extends RepoEntityBase<PersistentVolumeClaimEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TPersistentVolumeClaimSpec

    @RepoEntityField({ isReadonly: true })
    status: TPersistentVolumeClaimStatus

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get phase(): TPersistentVolumeClaimPhase | undefined {
        return this.status?.phase
    }

    get requestedStorage(): string {
        return this.spec?.resources?.requests?.storage ?? ''
    }

    get allocatedStorage(): string {
        return this.status?.capacity?.storage ?? ''
    }

    get storageClassName(): string {
        return this.spec?.storageClassName ?? ''
    }

    get volumeName(): string {
        return this.spec?.volumeName ?? ''
    }

    get accessModes(): string[] {
        return this.spec?.accessModes ?? []
    }

    get accessModesText(): string {
        return this.accessModes.map(p => AccessModeCatalog.short(p)).join(', ')
    }

    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        switch (this.phase) {
            case 'Bound':
                return 'ok'
            case 'Pending':
                return 'pending'
            case 'Lost':
                return 'error'
            default:
                return 'unknown'
        }
    }

    get isProblematic(): boolean {
        return KubeObjectStateCatalog.isProblematic(this.state)
    }
}
