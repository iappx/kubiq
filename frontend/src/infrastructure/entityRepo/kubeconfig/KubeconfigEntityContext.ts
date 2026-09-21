import { EntityContextBase, RepoEntitySet } from '@iappx/entity-repo'
import { KubeconfigContextEntity } from '@/domain/entities/kubeconfig/KubeconfigContextEntity'
import { KubeconfigEntityQuery } from '@/infrastructure/entityRepo/kubeconfig/KubeconfigEntityQuery'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'

export class KubeconfigEntityContext extends EntityContextBase<FileSystemTransport> {
    // KUBECONFIG may name several files and the user may open another, so the set
    // holds no path: forFile() binds the fresh query it hands out to one file.
    @RepoEntitySet(() => KubeconfigContextEntity, () => KubeconfigEntityQuery, { file: '' })
    public contexts: KubeconfigEntityQuery

    public forFile(path: string): KubeconfigEntityQuery {
        return this.contexts.forFile(path)
    }
}
