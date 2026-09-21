import { describe, expect, it } from 'vitest'
import { MonacoThemeTokens } from '@/application/services/monacoEditor/constants/MonacoThemeTokens'
import { MonacoHslColor } from '@/application/services/monacoEditor/models/MonacoHslColor'
import { MonacoThemeBuilder } from '@/application/services/monacoEditor/models/MonacoThemeBuilder'

// The values the project's own index.css carries for the Teal palette.
const light: Record<string, string> = {
    '--background': '0 0% 100%',
    '--foreground': '200 20% 13%',
    '--muted': '200 20% 96%',
    '--muted-foreground': '200 9% 46%',
    '--primary': '189 90% 29%',
    '--accent': '262 62% 52%',
    '--destructive': '0 72% 48%',
    '--warning': '38 96% 33%',
    '--border': '200 16% 88%',
    '--ring': '189 90% 29%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '200 20% 13%',
    '--font-mono': 'ui-monospace, Menlo, monospace',
    '--density-text': '12px',
}

const dark: Record<string, string> = { ...light, '--background': '200 18% 10%', '--primary': '187 72% 58%' }

describe('MonacoHslColor', () => {
    it('turns the bare triple a token holds into hex', () => {
        expect(MonacoHslColor.toHex('0 0% 100%')).toBe('#ffffff')
        expect(MonacoHslColor.toHex('0 0% 0%')).toBe('#000000')
    })

    it('converts the brand teal', () => {
        expect(MonacoHslColor.toHex('189 90% 29%')).toBe('#07798d')
    })

    it('appends an alpha byte only when one was asked for', () => {
        expect(MonacoHslColor.toHex('0 0% 0%', 1)).toBe('#000000')
        expect(MonacoHslColor.toHex('0 0% 0%', 0.5)).toBe('#00000080')
    })

    it('reads a token that arrived wrapped in hsl()', () => {
        expect(MonacoHslColor.toHex('hsl(0 0% 100%)')).toBe('#ffffff')
    })

    it('falls back to black rather than emitting something Monaco will reject', () => {
        expect(MonacoHslColor.toHex('')).toBe(MonacoHslColor.fallback)
        expect(MonacoHslColor.toHex('not a colour')).toBe(MonacoHslColor.fallback)
    })
})

describe('MonacoThemeBuilder', () => {
    it('paints the editor background with the application background', () => {
        expect(MonacoThemeBuilder.build(light, false).colors['editor.background'])
            .toBe(MonacoHslColor.toHex(light['--background']))
    })

    it('gives keys the brand colour and literals the accent', () => {
        const rules = MonacoThemeBuilder.build(light, false).rules

        expect(rules.find(rule => rule.token === 'type')?.foreground)
            .toBe(MonacoHslColor.toHex(light['--primary']).replace('#', ''))
        expect(rules.find(rule => rule.token === 'number')?.foreground)
            .toBe(MonacoHslColor.toHex(light['--accent']).replace('#', ''))
    })

    it('never spends a status colour on syntax', () => {
        const rules = MonacoThemeBuilder.build(light, false).rules
        const success = MonacoHslColor.toHex('142 58% 32%').replace('#', '')

        expect(rules.map(rule => rule.foreground)).not.toContain(success)
    })

    it('follows the theme rather than shipping one palette for both', () => {
        const lightTheme = MonacoThemeBuilder.build(light, false)
        const darkTheme = MonacoThemeBuilder.build(dark, true)

        expect(lightTheme.colors['editor.background']).not.toBe(darkTheme.colors['editor.background'])
        expect(lightTheme.base).toBe('vs')
        expect(darkTheme.base).toBe('vs-dark')
    })

    it('marks errors and warnings with the tokens the rest of the application uses', () => {
        const colors = MonacoThemeBuilder.build(light, false).colors

        expect(colors['editorError.foreground']).toBe(MonacoHslColor.toHex(light['--destructive']))
        expect(colors['editorWarning.foreground']).toBe(MonacoHslColor.toHex(light['--warning']))
    })

    it('takes the editor font and size from the same tokens as everything else', () => {
        expect(MonacoThemeBuilder.fontFamily(light)).toBe(light[MonacoThemeTokens.fontMono])
        expect(MonacoThemeBuilder.fontSize(light, 99)).toBe(12)
        expect(MonacoThemeBuilder.fontSize({}, 99)).toBe(99)
    })

    it('reads every token it paints with', () => {
        const values = MonacoThemeTokens.all()

        expect(values).toContain('--primary')
        expect(values).toContain('--background')
        expect(new Set(values).size).toBe(values.length)
    })
})
