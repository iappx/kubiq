import { EntityContextBase, RepoEntitySet } from '@iappx/entity-repo'
import { ClusterSettingsEntity } from '@/domain/entities/settings/ClusterSettingsEntity'
import { FileEntityQuery } from '@/infrastructure/entityRepo/queries/FileEntityQuery'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'

export class SettingsEntityContext extends EntityContextBase<FileSystemTransport> {
    @RepoEntitySet(() => ClusterSettingsEntity, () => FileEntityQuery, { file: 'userdata:settings/clusters.json' })
    public clusters: FileEntityQuery<ClusterSettingsEntity>
}
