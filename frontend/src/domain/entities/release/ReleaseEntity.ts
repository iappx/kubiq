import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ReleaseAssetEntity } from '@/domain/entities/release/ReleaseAssetEntity'

export class ReleaseEntity extends RepoEntityBase<ReleaseEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    id: number

    @RepoEntityField()
    tagName: string

    @RepoEntityField()
    name: string

    @RepoEntityField()
    draft: boolean

    @RepoEntityField()
    prerelease: boolean

    @RepoEntityField()
    htmlUrl: string

    @RepoEntityField()
    publishedAt: string

    @RepoEntityField()
    body: string

    @RepoEntityField({ nestedType: () => ReleaseAssetEntity, isArray: true })
    assets: ReleaseAssetEntity[]
}
