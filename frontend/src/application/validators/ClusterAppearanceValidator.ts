import { injectable } from 'tsyringe'
import { ClusterIconColorCatalog } from '@/domain/entities/catalog/ClusterIconColorCatalog'
import { ClusterIconGlyphCatalog } from '@/domain/entities/catalog/ClusterIconGlyphCatalog'
import { ClusterIconKindCatalog } from '@/domain/entities/catalog/ClusterIconKindCatalog'
import { ClusterMonogram } from '@/domain/entities/catalog/ClusterMonogram'
import type { TClusterAppearanceDraft } from '@/domain/entities/catalog/types/TClusterAppearanceDraft'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class ClusterAppearanceValidator {
    public static readonly maxDisplayNameLength: number = 64

    public validate(draft: TClusterAppearanceDraft, hasStoredImage: boolean): TValidationResult {
        const errors: Record<string, string> = {}

        if (draft.displayName.trim().length > ClusterAppearanceValidator.maxDisplayNameLength) {
            errors.displayName = `Keep the name to ${ClusterAppearanceValidator.maxDisplayNameLength} characters`
        }

        if (!ClusterIconKindCatalog.has(draft.iconKind)) {
            errors.iconKind = 'Choose how the icon looks'
        }

        if (!ClusterIconColorCatalog.has(draft.color)) {
            errors.color = 'Choose a color'
        }

        if (draft.iconKind === 'initials') {
            const initials = draft.initials.replace(/\s+/g, '')

            if (initials === '') {
                errors.initials = 'Enter a letter or two to show on the icon'
            } else if (Array.from(initials).length > ClusterMonogram.maxLength) {
                errors.initials = `Use at most ${ClusterMonogram.maxLength} characters`
            }
        }

        if (draft.iconKind === 'glyph' && !ClusterIconGlyphCatalog.has(draft.glyph)) {
            errors.glyph = 'Choose an icon'
        }

        if (draft.iconKind === 'image' && draft.imageFile === '' && !hasStoredImage) {
            errors.image = 'Choose an image file'
        }

        return { valid: Object.keys(errors).length === 0, errors }
    }
}
