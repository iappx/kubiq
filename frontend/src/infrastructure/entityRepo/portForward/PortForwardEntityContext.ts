import { EntityContextBase, RepoEntitySet } from '@iappx/entity-repo'
import { PortForwardEntity } from '@/domain/entities/portForward/PortForwardEntity'
import { FileEntityQuery } from '@/infrastructure/entityRepo/queries/FileEntityQuery'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'

export class PortForwardEntityContext extends EntityContextBase<FileSystemTransport> {
    @RepoEntitySet(() => PortForwardEntity, () => FileEntityQuery, { file: 'userdata:forwards/port-forwards.json' })
    public forwards: FileEntityQuery<PortForwardEntity>
}
