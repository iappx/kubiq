import { describe, expect, it } from 'vitest'
import { ClusterAppearanceValidator } from '@/application/validators/ClusterAppearanceValidator'
import type { TClusterAppearanceDraft } from '@/domain/entities/catalog/types/TClusterAppearanceDraft'

const validator = new ClusterAppearanceValidator()

const draft = (overrides: Partial<TClusterAppearanceDraft> = {}): TClusterAppearanceDraft => ({
    displayName: '',
    iconKind: 'initials',
    initials: 'PR',
    color: 'teal',
    glyph: 'server',
    imageFile: '',
    ...overrides,
})

describe('ClusterAppearanceValidator', () => {
    it('accepts the defaults', () => {
        expect(validator.validate(draft(), false)).toEqual({ valid: true, errors: {} })
    })

    it('accepts an empty display name, which means the context name', () => {
        expect(validator.validate(draft({ displayName: '   ' }), false).valid).toBe(true)
    })

    it('refuses a display name that will not fit anywhere', () => {
        const result = validator.validate(draft({ displayName: 'x'.repeat(ClusterAppearanceValidator.maxDisplayNameLength + 1) }), false)

        expect(result.errors.displayName).toBeDefined()
    })

    it('asks for initials when the icon shows them', () => {
        expect(validator.validate(draft({ initials: ' ' }), false).errors.initials).toBeDefined()
    })

    it('refuses more than four initials', () => {
        expect(validator.validate(draft({ initials: 'ABCDE' }), false).errors.initials).toBe('Use at most 4 characters')
    })

    it('ignores the initials when the icon does not show them', () => {
        expect(validator.validate(draft({ iconKind: 'glyph', initials: '' }), false).valid).toBe(true)
    })

    it('refuses a symbol and a color outside the catalogue', () => {
        const result = validator.validate(draft({ iconKind: 'glyph', glyph: 'unicorn' as never, color: 'pink' as never }), false)

        expect(Object.keys(result.errors).sort()).toEqual(['color', 'glyph'])
    })

    it('asks for an image when there is none yet', () => {
        expect(validator.validate(draft({ iconKind: 'image' }), false).errors.image).toBe('Choose an image file')
    })

    it('accepts an image icon that keeps the image already stored', () => {
        expect(validator.validate(draft({ iconKind: 'image' }), true).valid).toBe(true)
    })

    it('accepts an image icon with a newly picked file', () => {
        expect(validator.validate(draft({ iconKind: 'image', imageFile: 'D:/logo.png' }), false).valid).toBe(true)
    })

    it('collects every problem in one pass', () => {
        const result = validator.validate(draft({ displayName: 'x'.repeat(100), initials: '', color: 'pink' as never }), false)

        expect(Object.keys(result.errors).sort()).toEqual(['color', 'displayName', 'initials'])
    })
})
