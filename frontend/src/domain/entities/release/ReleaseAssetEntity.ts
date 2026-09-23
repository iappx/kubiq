import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'

export class ReleaseAssetEntity extends RepoEntityBase<ReleaseAssetEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    id: number

    @RepoEntityField()
    name: string

    @RepoEntityField()
    size: number

    @RepoEntityField()
    contentType: string

    @RepoEntityField()
    browserDownloadUrl: string

    @RepoEntityField()
    digest: string
}
