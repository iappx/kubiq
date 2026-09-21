import { EntityContextBase } from '@iappx/entity-repo'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'

export class AppEntityContext extends EntityContextBase<FileSystemTransport> {
}
