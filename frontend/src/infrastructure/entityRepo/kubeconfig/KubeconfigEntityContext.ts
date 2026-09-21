import { EntityContextBase, RepoEntitySet } from '@iappx/entity-repo'
import { KubeconfigContextEntity } from '@/domain/entities/kubeconfig/KubeconfigContextEntity'
import { KubeconfigEntityQuery } from '@/infrastructure/entityRepo/kubeconfig/KubeconfigEntityQuery'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'

export class KubeconfigEntityContext extends EntityContextBase<FileSystemTransport> {
    // The empty path is deliberate: KUBECONFIG may name several files, so forFile()
    // binds each fresh query to one of them.
    @RepoEntitySet(() => KubeconfigContextEntity, () => KubeconfigEntityQuery, { file: '' })
    public contexts: KubeconfigEntityQuery

    public forFile(path: string): KubeconfigEntityQuery {
        return this.contexts.forFile(path)
    }
}
