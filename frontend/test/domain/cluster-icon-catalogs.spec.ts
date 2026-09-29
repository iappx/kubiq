import { describe, expect, it } from 'vitest'
import { ClusterIconColorCatalog } from '@/domain/entities/catalog/ClusterIconColorCatalog'
import { ClusterIconGlyphCatalog } from '@/domain/entities/catalog/ClusterIconGlyphCatalog'
import { ClusterIconKindCatalog } from '@/domain/entities/catalog/ClusterIconKindCatalog'

describe('cluster icon catalogues', () => {
    it('knows the three kinds of icon', () => {
        expect(ClusterIconKindCatalog.keys()).toEqual(['initials', 'glyph', 'image'])
    })

    it('falls back to initials for a kind it does not know', () => {
        expect(ClusterIconKindCatalog.of('emoji')).toBe('initials')
        expect(ClusterIconKindCatalog.of(undefined)).toBe('initials')
        expect(ClusterIconKindCatalog.of('glyph')).toBe('glyph')
    })

    it('titles every color and every symbol', () => {
        for (const color of ClusterIconColorCatalog.keys()) {
            expect(ClusterIconColorCatalog.title(color)).not.toBe('')
        }
        for (const glyph of ClusterIconGlyphCatalog.keys()) {
            expect(ClusterIconGlyphCatalog.title(glyph)).not.toBe('')
        }
    })

    it('replaces an unknown color or symbol with the fallback', () => {
        expect(ClusterIconColorCatalog.of('chartreuse')).toBe(ClusterIconColorCatalog.fallback)
        expect(ClusterIconGlyphCatalog.of('unicorn')).toBe(ClusterIconGlyphCatalog.fallback)
    })

    it('does not mistake a prototype member for a value', () => {
        expect(ClusterIconColorCatalog.has('constructor')).toBe(false)
        expect(ClusterIconGlyphCatalog.has('toString')).toBe(false)
        expect(ClusterIconKindCatalog.has('hasOwnProperty')).toBe(false)
    })
})
