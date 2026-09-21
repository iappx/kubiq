import { EntityContextBase, RepoEntitySet } from '@iappx/entity-repo'
import { KubeconfigSourceEntity } from '@/domain/entities/catalog/KubeconfigSourceEntity'
import { NamespaceSelectionEntity } from '@/domain/entities/catalog/NamespaceSelectionEntity'
import { PinnedClusterEntity } from '@/domain/entities/catalog/PinnedClusterEntity'
import { FileEntityQuery } from '@/infrastructure/entityRepo/queries/FileEntityQuery'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'

// `userdata:` resolves against the user profile in Go, not next to the binary,
// which may be reinstalled over or installed read-only.
export class ClusterCatalogEntityContext extends EntityContextBase<FileSystemTransport> {
    @RepoEntitySet(() => PinnedClusterEntity, () => FileEntityQuery, { file: 'userdata:clusters/pinned.json' })
    public pinned: FileEntityQuery<PinnedClusterEntity>

    @RepoEntitySet(() => NamespaceSelectionEntity, () => FileEntityQuery, { file: 'userdata:clusters/namespaces.json' })
    public namespaceSelections: FileEntityQuery<NamespaceSelectionEntity>

    @RepoEntitySet(() => KubeconfigSourceEntity, () => FileEntityQuery, { file: 'userdata:clusters/kubeconfigs.json' })
    public kubeconfigSources: FileEntityQuery<KubeconfigSourceEntity>
}
