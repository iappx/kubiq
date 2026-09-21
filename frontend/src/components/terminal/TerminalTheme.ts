import type { ITheme } from '@xterm/xterm'

export class TerminalTheme {
    private static readonly ansi: readonly string[] = [
        'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
        'bright-black', 'bright-red', 'bright-green', 'bright-yellow',
        'bright-blue', 'bright-magenta', 'bright-cyan', 'bright-white',
    ]

    public static build(root: HTMLElement): ITheme {
        const palette = TerminalTheme.ansi.map(name => TerminalTheme.read(root, `--ansi-${name}`))

        return {
            background: TerminalTheme.read(root, '--background'),
            foreground: TerminalTheme.read(root, '--foreground'),
            cursor: TerminalTheme.read(root, '--primary'),
            cursorAccent: TerminalTheme.read(root, '--background'),
            selectionBackground: TerminalTheme.read(root, '--accent', 0.28),
            black: palette[0],
            red: palette[1],
            green: palette[2],
            yellow: palette[3],
            blue: palette[4],
            magenta: palette[5],
            cyan: palette[6],
            white: palette[7],
            brightBlack: palette[8],
            brightRed: palette[9],
            brightGreen: palette[10],
            brightYellow: palette[11],
            brightBlue: palette[12],
            brightMagenta: palette[13],
            brightCyan: palette[14],
            brightWhite: palette[15],
        }
    }

    public static fontFamily(root: HTMLElement): string {
        return getComputedStyle(root).getPropertyValue('--font-mono').trim() || 'monospace'
    }

    // The tokens hold bare HSL components for Tailwind to wrap; xterm needs them wrapped.
    public static read(root: HTMLElement, token: string, alpha: number = 1): string {
        const value = getComputedStyle(root).getPropertyValue(token).trim()
        if (value === '') {
            return alpha === 1 ? '#000000' : 'rgba(0, 0, 0, 0.3)'
        }

        return alpha === 1 ? `hsl(${value})` : `hsla(${value} / ${alpha})`
    }
}
