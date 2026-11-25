import { ApiError } from '@/domain/errors/ApiError'
import type { TLaunchSpec } from '@/infrastructure/process/types/TLaunchSpec'

export class ExternalTerminalCommand {
    public static readonly windowsTerminalCandidates: readonly string[] = ['wt']

    public static readonly linuxTerminalCandidates: readonly string[] = [
        'x-terminal-emulator',
        'gnome-terminal',
        'konsole',
        'kitty',
        'alacritty',
        'wezterm',
        'xfce4-terminal',
        'xterm',
    ]

    public static readonly customMissing: string = 'Custom terminal is not configured'

    public static readonly customMissingHelp: string = 'Set a terminal application or executable in Settings under Terminal.'

    public static readonly linuxNotFound: string = 'No system terminal was found'

    public static readonly linuxNotFoundHelp: string = 'Install a terminal emulator or set a custom terminal in Settings under Terminal.'

    private static readonly macCliTerminals: readonly string[] = ['kitty', 'alacritty', 'wezterm', 'ghostty']

    private static readonly linuxDashETerminals: readonly string[] = [
        'x-terminal-emulator',
        'konsole',
        'alacritty',
        'xfce4-terminal',
        'xterm',
        'ghostty',
        'tilix',
        'terminator',
        'urxvt',
        'foot',
        'lxterminal',
        'mate-terminal',
    ]

    public static build(options: {
        platform: 'windows' | 'darwin' | 'linux'
        mode: 'system' | 'custom'
        customCommand: string
        detectedTerminal: string
        shellCommand: string
        shellArgs: string[]
        env: Record<string, string>
    }): TLaunchSpec {
        const env = { ...options.env }

        if (options.platform === 'windows') {
            return ExternalTerminalCommand.forWindows(options.mode, options.customCommand, options.detectedTerminal, options.shellCommand, options.shellArgs, env)
        }

        if (options.platform === 'darwin') {
            return ExternalTerminalCommand.forDarwin(options.mode, options.customCommand, options.detectedTerminal, options.shellCommand, options.shellArgs, env)
        }

        return ExternalTerminalCommand.forLinux(options.mode, options.customCommand, options.detectedTerminal, options.shellCommand, options.shellArgs, env)
    }

    public static quotePosix(value: string): string {
        return `'${value.replace(/'/g, "'\\''")}'`
    }

    public static escapeAppleScript(value: string): string {
        return value
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\r?\n/g, ' ')
    }

    public static posixBootstrap(
        env: Record<string, string>,
        shellCommand: string,
        shellArgs: string[],
    ): string {
        const exports = Object.entries(env)
            .filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
            .map(([key, value]) => `export ${key}=${ExternalTerminalCommand.quotePosix(value)}`)

        const command = [shellCommand, ...shellArgs]
            .filter(part => part !== '')
            .map(part => ExternalTerminalCommand.quotePosix(part))
            .join(' ')

        const parts = [...exports]
        if (command !== '') {
            parts.push(`exec ${command}`)
        }

        return parts.join('; ')
    }

    private static forWindows(
        mode: 'system' | 'custom',
        customCommand: string,
        detectedTerminal: string,
        shellCommand: string,
        shellArgs: string[],
        env: Record<string, string>,
    ): TLaunchSpec {
        if (mode === 'custom') {
            const custom = customCommand.trim()
            if (custom === '') {
                throw new ApiError(ExternalTerminalCommand.customMissing, ExternalTerminalCommand.customMissingHelp)
            }

            if (ExternalTerminalCommand.executableName(custom) === 'wt') {
                return { path: custom, args: ['new-tab', shellCommand, ...shellArgs], env }
            }

            return { path: custom, args: [], env }
        }

        const detected = detectedTerminal.trim()
        if (detected !== '' && ExternalTerminalCommand.executableName(detected) === 'wt') {
            return { path: detected, args: ['new-tab', shellCommand, ...shellArgs], env }
        }

        return { path: shellCommand, args: [...shellArgs], env }
    }

    private static forDarwin(
        mode: 'system' | 'custom',
        customCommand: string,
        detectedTerminal: string,
        shellCommand: string,
        shellArgs: string[],
        env: Record<string, string>,
    ): TLaunchSpec {
        const bootstrap = ExternalTerminalCommand.posixBootstrap(env, shellCommand, shellArgs)

        if (mode === 'system') {
            const detected = ExternalTerminalCommand.macAppName(detectedTerminal)
            if (detected === 'iterm' || detected === 'iterm2') {
                return ExternalTerminalCommand.iTermScript(bootstrap, env)
            }

            return ExternalTerminalCommand.terminalAppScript(bootstrap, env)
        }

        const custom = customCommand.trim()
        if (custom === '') {
            throw new ApiError(ExternalTerminalCommand.customMissing, ExternalTerminalCommand.customMissingHelp)
        }

        const appName = ExternalTerminalCommand.macAppName(custom)
        if (appName === 'terminal') {
            return ExternalTerminalCommand.terminalAppScript(bootstrap, env)
        }
        if (appName === 'iterm' || appName === 'iterm2') {
            return ExternalTerminalCommand.iTermScript(bootstrap, env)
        }

        if (ExternalTerminalCommand.isMacCliBinary(custom)) {
            return {
                path: custom,
                args: ExternalTerminalCommand.unixTerminalArgs(custom, shellCommand, shellArgs),
                env,
            }
        }

        return { path: 'open', args: ['-a', custom], env }
    }

    private static forLinux(
        mode: 'system' | 'custom',
        customCommand: string,
        detectedTerminal: string,
        shellCommand: string,
        shellArgs: string[],
        env: Record<string, string>,
    ): TLaunchSpec {
        const target = mode === 'custom' ? customCommand.trim() : detectedTerminal.trim()
        if (target === '') {
            throw mode === 'custom'
                ? new ApiError(ExternalTerminalCommand.customMissing, ExternalTerminalCommand.customMissingHelp)
                : new ApiError(ExternalTerminalCommand.linuxNotFound, ExternalTerminalCommand.linuxNotFoundHelp)
        }

        return {
            path: target,
            args: ExternalTerminalCommand.unixTerminalArgs(target, shellCommand, shellArgs),
            env,
        }
    }

    private static terminalAppScript(bootstrap: string, env: Record<string, string>): TLaunchSpec {
        const script = ExternalTerminalCommand.escapeAppleScript(bootstrap)

        return {
            path: 'osascript',
            args: [
                '-e',
                'tell application "Terminal" to activate',
                '-e',
                `tell application "Terminal" to do script "${script}"`,
            ],
            env,
        }
    }

    private static iTermScript(bootstrap: string, env: Record<string, string>): TLaunchSpec {
        const script = ExternalTerminalCommand.escapeAppleScript(bootstrap)

        return {
            path: 'osascript',
            args: [
                '-e',
                'tell application "iTerm" to activate',
                '-e',
                `tell application "iTerm" to create window with default profile command "${script}"`,
            ],
            env,
        }
    }

    private static unixTerminalArgs(target: string, shellCommand: string, shellArgs: string[]): string[] {
        const name = ExternalTerminalCommand.executableName(target)
        const invocation = shellCommand === '' ? [] : [shellCommand, ...shellArgs]
        if (invocation.length === 0) {
            return []
        }

        if (name === 'gnome-terminal') {
            return ['--', ...invocation]
        }

        if (name === 'kitty') {
            return invocation
        }

        if (name === 'wezterm') {
            return ['start', '--', ...invocation]
        }

        if (ExternalTerminalCommand.linuxDashETerminals.includes(name)) {
            return ['-e', ...invocation]
        }

        return []
    }

    private static isMacCliBinary(value: string): boolean {
        if (value.endsWith('.app')) {
            return false
        }

        if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../') || value.startsWith('~')) {
            return true
        }

        return ExternalTerminalCommand.macCliTerminals.includes(ExternalTerminalCommand.executableName(value))
    }

    private static macAppName(value: string): string {
        const trimmed = value.trim()
        if (trimmed === '') {
            return ''
        }

        const segment = trimmed.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''

        return segment.toLowerCase().replace(/\.app$/, '')
    }

    private static executableName(command: string): string {
        const trimmed = command.trim()
        if (trimmed === '') {
            return ''
        }

        const segment = trimmed.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''

        return segment.toLowerCase().replace(/\.exe$/, '')
    }
}
