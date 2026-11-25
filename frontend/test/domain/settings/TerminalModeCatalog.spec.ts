import { describe, expect, it } from 'vitest'
import { TerminalModeCatalog } from '@/domain/models/settings/TerminalModeCatalog'

describe('TerminalModeCatalog', () => {
    it('lists the supported modes in display order', () => {
        expect(TerminalModeCatalog.modes).toEqual(['in-app', 'system', 'custom'])
    })

    it('parses known modes and falls back to in-app for unknown values', () => {
        expect(TerminalModeCatalog.parse('in-app')).toBe('in-app')
        expect(TerminalModeCatalog.parse('system')).toBe('system')
        expect(TerminalModeCatalog.parse('custom')).toBe('custom')
        expect(TerminalModeCatalog.parse('external')).toBe('in-app')
        expect(TerminalModeCatalog.parse(null)).toBe('in-app')
        expect(TerminalModeCatalog.parse(42)).toBe('in-app')
    })

    it('reports whether a value is a known mode', () => {
        expect(TerminalModeCatalog.has('in-app')).toBe(true)
        expect(TerminalModeCatalog.has('system')).toBe(true)
        expect(TerminalModeCatalog.has('custom')).toBe(true)
        expect(TerminalModeCatalog.has('other')).toBe(false)
    })

    it('provides titles and descriptions for every mode', () => {
        for (const mode of TerminalModeCatalog.modes) {
            expect(TerminalModeCatalog.title(mode).length).toBeGreaterThan(0)
            expect(TerminalModeCatalog.description(mode).length).toBeGreaterThan(0)
        }
    })

    it('distinguishes external modes from the in-app dock', () => {
        expect(TerminalModeCatalog.isExternal('in-app')).toBe(false)
        expect(TerminalModeCatalog.isExternal('system')).toBe(true)
        expect(TerminalModeCatalog.isExternal('custom')).toBe(true)
    })
})
