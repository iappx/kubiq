import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import type { TClusterIconColor } from '@/domain/entities/catalog/types/TClusterIconColor'
import type { TClusterIconGlyph } from '@/domain/entities/catalog/types/TClusterIconGlyph'
import type { TClusterIconKind } from '@/domain/entities/catalog/types/TClusterIconKind'

export class ClusterAppearanceEntity extends RepoEntityBase<ClusterAppearanceEntity> {
    @RepoEntityField({ isPrimaryKey: true })
    clusterId: string

    @RepoEntityField()
    displayName: string

    @RepoEntityField()
    iconKind: TClusterIconKind

    @RepoEntityField()
    initials: string

    @RepoEntityField()
    color: TClusterIconColor

    @RepoEntityField()
    glyph: TClusterIconGlyph

    @RepoEntityField()
    imagePath: string

    @RepoEntityField()
    updatedAt: number
}
