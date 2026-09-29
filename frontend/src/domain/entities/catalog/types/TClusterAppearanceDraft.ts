import type { TClusterIconColor } from '@/domain/entities/catalog/types/TClusterIconColor'
import type { TClusterIconGlyph } from '@/domain/entities/catalog/types/TClusterIconGlyph'
import type { TClusterIconKind } from '@/domain/entities/catalog/types/TClusterIconKind'

export type TClusterAppearanceDraft = {
    displayName: string
    iconKind: TClusterIconKind
    initials: string
    color: TClusterIconColor
    glyph: TClusterIconGlyph
    imageFile: string
}
