import { afterEach, describe, expect, it } from 'vitest'
import { TerminalTheme } from '@/components/terminal/TerminalTheme'

describe('TerminalTheme', () => {
    afterEach(() => {
        document.documentElement.style.removeProperty('--font-mono')
    })

    it('falls back to monospace when the CSS variable is absent', () => {
        expect(TerminalTheme.fontFamily(document.documentElement)).toBe('monospace')
    })

    it('uses the application monospace token when no custom font is configured', () => {
        document.documentElement.style.setProperty('--font-mono', 'ui-monospace, monospace')

        expect(TerminalTheme.fontFamily(document.documentElement)).toBe('ui-monospace, monospace')
        expect(TerminalTheme.fontFamily(document.documentElement, '   ')).toBe('ui-monospace, monospace')
    })

    it('prepends a configured font family before the application fallback', () => {
        document.documentElement.style.setProperty('--font-mono', 'ui-monospace, monospace')

        expect(TerminalTheme.fontFamily(document.documentElement, '  JetBrainsMono Nerd Font  '))
            .toBe('JetBrainsMono Nerd Font, ui-monospace, monospace')
    })
})
