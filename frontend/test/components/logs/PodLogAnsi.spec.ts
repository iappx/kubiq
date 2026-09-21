import { describe, expect, it } from 'vitest'
import { PodLogAnsi } from '@/components/logs/PodLogAnsi'

const esc = ''

// A NestJS line, which is what made the colours matter: SGR 32, a 256-colour index, and resets.
const nestLine = `${esc}[32m[Nest] 33 - ${esc}[39m09/21/2026, 3:50:24 PM ${esc}[32m LOG${esc}[39m `
    + `${esc}[38;5;3m[SQL (0 ms)] ${esc}[39m${esc}[32mExecuted (default): SELECT 1+1 AS result${esc}[39m`

describe('PodLogAnsi.strip', () => {
    it('returns a line without escapes untouched', () => {
        expect(PodLogAnsi.strip('plain line')).toBe('plain line')
    })

    it('drops every escape sequence', () => {
        expect(PodLogAnsi.strip(nestLine))
            .toBe('[Nest] 33 - 09/21/2026, 3:50:24 PM  LOG [SQL (0 ms)] Executed (default): SELECT 1+1 AS result')
    })

    it('drops sequences that are not colour changes', () => {
        expect(PodLogAnsi.strip(`before${esc}[2Kafter`)).toBe('beforeafter')
    })

    it('measures the visible width, not the raw one', () => {
        expect(PodLogAnsi.width(`${esc}[31mred${esc}[39m`)).toBe(3)
        expect(PodLogAnsi.width('red')).toBe(3)
    })
})

describe('PodLogAnsi.runs', () => {
    it('returns one unstyled run for a line with no escapes', () => {
        expect(PodLogAnsi.runs('plain')).toEqual([{ text: 'plain', style: PodLogAnsi.plain() }])
    })

    it('always rebuilds the visible line from its runs', () => {
        const rejoined = PodLogAnsi.runs(nestLine).map(run => run.text).join('')

        expect(rejoined).toBe(PodLogAnsi.strip(nestLine))
    })

    it('paints a run in the colour that opened it', () => {
        const runs = PodLogAnsi.runs(`${esc}[32mok${esc}[39m done`)

        expect(runs).toEqual([
            { text: 'ok', style: { ...PodLogAnsi.plain(), color: 'hsl(var(--ansi-green))' } },
            { text: ' done', style: PodLogAnsi.plain() },
        ])
    })

    it('reads the bright colours', () => {
        expect(PodLogAnsi.runs(`${esc}[91mhot`)[0].style.color).toBe('hsl(var(--ansi-bright-red))')
    })

    it('reads a background colour', () => {
        expect(PodLogAnsi.runs(`${esc}[41mhot`)[0].style.background).toBe('hsl(var(--ansi-red))')
    })

    it('maps the first sixteen 256-colour indexes onto the palette', () => {
        expect(PodLogAnsi.runs(`${esc}[38;5;3mwarn`)[0].style.color).toBe('hsl(var(--ansi-yellow))')
    })

    it('computes a 256-colour index from the xterm cube', () => {
        expect(PodLogAnsi.runs(`${esc}[38;5;196mred`)[0].style.color).toBe('rgb(255, 0, 0)')
    })

    it('computes a 256-colour index from the xterm greys', () => {
        expect(PodLogAnsi.runs(`${esc}[38;5;232mdark`)[0].style.color).toBe('rgb(8, 8, 8)')
    })

    it('reads a truecolour sequence', () => {
        expect(PodLogAnsi.runs(`${esc}[38;2;10;20;30mrgb`)[0].style.color).toBe('rgb(10, 20, 30)')
    })

    it('keeps the weight and the colour of one sequence apart', () => {
        const style = PodLogAnsi.runs(`${esc}[1;4;36mboth`)[0].style

        expect(style.bold).toBe(true)
        expect(style.underline).toBe(true)
        expect(style.color).toBe('hsl(var(--ansi-cyan))')
    })

    it('clears everything on a reset', () => {
        const runs = PodLogAnsi.runs(`${esc}[1;31mloud${esc}[0mquiet`)

        expect(runs[1].style).toEqual(PodLogAnsi.plain())
    })

    it('treats a bare sequence as a reset', () => {
        expect(PodLogAnsi.runs(`${esc}[31mred${esc}[mplain`)[1].style).toEqual(PodLogAnsi.plain())
    })

    it('carries the style across a sequence that changes only the colour', () => {
        const runs = PodLogAnsi.runs(`${esc}[1mbold ${esc}[31mred`)

        expect(runs[1].style.bold).toBe(true)
        expect(runs[1].style.color).toBe('hsl(var(--ansi-red))')
    })

    // lastIndex survives between calls on a shared /g regex, so the second line would start
    // being read from wherever the first one stopped.
    it('reads the same line the same way twice', () => {
        expect(PodLogAnsi.runs(nestLine)).toEqual(PodLogAnsi.runs(nestLine))
    })
})
