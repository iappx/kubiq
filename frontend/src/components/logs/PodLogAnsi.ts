import type { TPodLogRun } from '@/components/logs/types/TPodLogRun'
import type { TPodLogStyle } from '@/components/logs/types/TPodLogStyle'

export class PodLogAnsi {
    public static readonly escape: string = ''

    // Assembled instead of written as a literal: the escape is a control character, which a
    // regular expression literal is not allowed to carry.
    private static readonly pattern: RegExp = new RegExp(`${PodLogAnsi.escape}\\[[0-?]*[ -/]*[@-~]`, 'g')

    private static readonly names: readonly string[] = [
        'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
        'bright-black', 'bright-red', 'bright-green', 'bright-yellow',
        'bright-blue', 'bright-magenta', 'bright-cyan', 'bright-white',
    ]

    // The six steps of the xterm colour cube, and the start and stride of the greys after it.
    private static readonly steps: readonly number[] = [0, 95, 135, 175, 215, 255]

    private static readonly greyFrom: number = 8

    private static readonly greyStep: number = 10

    public static has(text: string): boolean {
        return text.includes(PodLogAnsi.escape)
    }

    public static strip(text: string): string {
        return PodLogAnsi.has(text) ? text.replace(PodLogAnsi.pattern, '') : text
    }

    public static width(text: string): number {
        return PodLogAnsi.has(text) ? PodLogAnsi.strip(text).length : text.length
    }

    public static runs(text: string): TPodLogRun[] {
        if (!PodLogAnsi.has(text)) {
            return [{ text, style: PodLogAnsi.plain() }]
        }

        // The scan below shares the pattern with strip(), and an exec loop leaves its
        // position behind where it stopped.
        const pattern = PodLogAnsi.pattern
        pattern.lastIndex = 0

        const runs: TPodLogRun[] = []
        let style = PodLogAnsi.plain()
        let from = 0
        let found = pattern.exec(text)

        while (found !== null) {
            if (found.index > from) {
                runs.push({ text: text.slice(from, found.index), style })
            }
            if (found[0].endsWith('m')) {
                style = PodLogAnsi.applied(style, found[0])
            }
            from = found.index + found[0].length
            found = pattern.exec(text)
        }

        if (from < text.length) {
            runs.push({ text: text.slice(from), style })
        }

        return runs.length === 0 ? [{ text: '', style: PodLogAnsi.plain() }] : runs
    }

    public static plain(): TPodLogStyle {
        return { color: '', background: '', bold: false, dim: false, italic: false, underline: false }
    }

    private static applied(style: TPodLogStyle, sequence: string): TPodLogStyle {
        const body = sequence.slice(2, -1)
        const codes = body === '' ? [0] : body.split(';').map(part => Number(part === '' ? '0' : part))
        let next = style

        for (let at = 0; at < codes.length; at += 1) {
            const code = codes[at]
            if (code !== 38 && code !== 48) {
                next = PodLogAnsi.simple(next, code)
                continue
            }

            const truecolour = codes[at + 1] === 2
            if (!truecolour && codes[at + 1] !== 5) {
                continue
            }

            const colour = truecolour
                ? PodLogAnsi.rgb(codes[at + 2], codes[at + 3], codes[at + 4])
                : PodLogAnsi.indexed(codes[at + 2])
            next = code === 38 ? { ...next, color: colour } : { ...next, background: colour }
            at += truecolour ? 4 : 2
        }

        return next
    }

    private static simple(style: TPodLogStyle, code: number): TPodLogStyle {
        if (code === 0) {
            return PodLogAnsi.plain()
        }
        if (code === 1 || code === 2) {
            return code === 1 ? { ...style, bold: true } : { ...style, dim: true }
        }
        if (code === 3 || code === 4) {
            return code === 3 ? { ...style, italic: true } : { ...style, underline: true }
        }
        if (code === 21 || code === 22) {
            return { ...style, bold: false, dim: false }
        }
        if (code === 23 || code === 24) {
            return code === 23 ? { ...style, italic: false } : { ...style, underline: false }
        }
        if (code === 39 || code === 49) {
            return code === 39 ? { ...style, color: '' } : { ...style, background: '' }
        }
        if (code >= 30 && code <= 37) {
            return { ...style, color: PodLogAnsi.token(code - 30) }
        }
        if (code >= 40 && code <= 47) {
            return { ...style, background: PodLogAnsi.token(code - 40) }
        }
        if (code >= 90 && code <= 97) {
            return { ...style, color: PodLogAnsi.token(code - 82) }
        }
        if (code >= 100 && code <= 107) {
            return { ...style, background: PodLogAnsi.token(code - 92) }
        }

        return style
    }

    private static indexed(index: number): string {
        if (!Number.isInteger(index) || index < 0 || index > 255) {
            return ''
        }
        if (index < PodLogAnsi.names.length) {
            return PodLogAnsi.token(index)
        }
        if (index >= 232) {
            const grey = PodLogAnsi.greyFrom + (index - 232) * PodLogAnsi.greyStep
            return PodLogAnsi.rgb(grey, grey, grey)
        }

        const offset = index - 16

        return PodLogAnsi.rgb(
            PodLogAnsi.steps[Math.floor(offset / 36)],
            PodLogAnsi.steps[Math.floor(offset / 6) % 6],
            PodLogAnsi.steps[offset % 6],
        )
    }

    private static token(index: number): string {
        return `hsl(var(--ansi-${PodLogAnsi.names[index]}))`
    }

    private static rgb(red: number, green: number, blue: number): string {
        const channel = (value: number): number => (Number.isInteger(value) ? Math.min(Math.max(value, 0), 255) : 0)

        return `rgb(${channel(red)}, ${channel(green)}, ${channel(blue)})`
    }
}
