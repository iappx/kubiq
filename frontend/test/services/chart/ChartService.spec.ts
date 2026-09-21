import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChartService } from '@/application/services/chart/ChartService'
import { ChartTokens } from '@/application/services/chart/constants/ChartTokens'
import { ChartTheme } from '@/application/services/chart/models/ChartTheme'
import { CssTokenAdapter } from '@/infrastructure/theme/CssTokenAdapter'

const values: Record<string, string> = {
    '--muted-foreground': '200 9% 46%',
    '--border': '200 16% 88%',
    '--primary': '189 90% 29%',
    '--font-sans': 'system-ui, sans-serif',
    '--chart-1': '189 90% 29%',
    '--chart-2': '262 62% 52%',
}

const read = vi.fn((names: readonly string[]) => {
    const found: Record<string, string> = {}
    names.forEach((name) => {
        if (values[name]) {
            found[name] = values[name]
        }
    })
    return found
})

const tokens = { read } as unknown as CssTokenAdapter

describe('ChartTokens', () => {
    it('asks for one token per series slot plus the chrome', () => {
        expect(ChartTokens.series()).toEqual(['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6'])
        expect(ChartTokens.all()).toContain('--muted-foreground')
        expect(ChartTokens.all()).toHaveLength(ChartTokens.seriesCount + 4)
    })
})

describe('ChartTheme', () => {
    // A canvas cannot read a CSS variable, and the tokens hold bare HSL components.
    it('wraps the bare token components into colours a canvas accepts', () => {
        const theme = ChartTheme.build(values)

        expect(theme.axis).toBe('hsl(200 9% 46%)')
        expect(theme.grid).toBe('hsl(200 16% 88%)')
        expect(theme.cursor).toBe('hsl(189 90% 29%)')
        expect(theme.font).toBe('system-ui, sans-serif')
    })

    it('falls back rather than painting nothing when a token is missing', () => {
        const theme = ChartTheme.build({})

        expect(theme.axis).toBe('#7f7f7f')
        expect(theme.font).not.toBe('')
        expect(theme.series).toHaveLength(ChartTokens.seriesCount)
    })

    it('cycles the palette so a seventh series still has a colour', () => {
        const theme = ChartTheme.build(values)

        expect(ChartTheme.colourAt(theme, 0)).toBe('hsl(189 90% 29%)')
        expect(ChartTheme.colourAt(theme, 1)).toBe('hsl(262 62% 52%)')
        expect(ChartTheme.colourAt(theme, ChartTokens.seriesCount)).toBe(ChartTheme.colourAt(theme, 0))
    })
})

describe('ChartService', () => {
    let service: ChartService

    beforeEach(() => {
        read.mockClear()
        service = new ChartService(tokens)
    })

    it('reads the theme from the tokens on every call, so a theme switch is picked up', () => {
        service.theme()
        service.theme()

        expect(read).toHaveBeenCalledTimes(2)
        expect(service.theme().series[0]).toBe('hsl(189 90% 29%)')
    })

    // The library is loaded on demand and must not be fetched twice.
    it('loads the plotting library once and hands the same one back', async () => {
        const first = await service.load()
        const second = await service.load()

        expect(typeof first).toBe('function')
        expect(second).toBe(first)
    })
})
