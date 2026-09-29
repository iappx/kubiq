import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import type { TPortForwardRemotePort } from '@/domain/entities/portForward/types/TPortForwardRemotePort'
import type { TPortForwardResource } from '@/domain/entities/portForward/types/TPortForwardResource'
import type { TPortForwardRestoreMode } from '@/domain/entities/portForward/types/TPortForwardRestoreMode'

export class PortForwardEntity extends RepoEntityBase<PortForwardEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    id: string

    @RepoEntityField()
    clusterId: string

    @RepoEntityField()
    namespace: string

    @RepoEntityField()
    resource: TPortForwardResource

    @RepoEntityField()
    name: string

    @RepoEntityField()
    remotePort: TPortForwardRemotePort

    // 0 asks the host for any free port.
    @RepoEntityField()
    localPort: number

    @RepoEntityField()
    lastLocalPort: number

    @RepoEntityField()
    restoreMode: TPortForwardRestoreMode

    @RepoEntityField()
    isStoppedByUser: boolean

    @RepoEntityField()
    createdAt: number
}
