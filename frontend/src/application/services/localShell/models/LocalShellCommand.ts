export class LocalShellCommand {
    public static readonly windowsShell: string = 'powershell.exe'

    public static readonly windowsPowerShellCore: string = 'pwsh'

    public static readonly unixShell: string = '/bin/bash'

    private static readonly powerShellNames: readonly string[] = ['powershell', 'pwsh']

    private static readonly loginShellNames: readonly string[] = ['bash', 'zsh', 'fish', 'sh', 'dash', 'ksh']

    public static commandFor(
        isWindows: boolean,
        preferred: string,
        configured: string = '',
        detectedWindowsShell: string = '',
    ): string {
        const override = configured.trim()
        if (override !== '') {
            return override
        }

        if (isWindows) {
            const detected = detectedWindowsShell.trim()
            return detected !== '' ? detected : LocalShellCommand.windowsShell
        }

        return preferred.trim() === '' ? LocalShellCommand.unixShell : preferred.trim()
    }

    public static argsFor(command: string): string[] {
        const executable = LocalShellCommand.executableName(command)
        if (LocalShellCommand.powerShellNames.includes(executable)) {
            return ['-NoLogo']
        }

        if (LocalShellCommand.loginShellNames.includes(executable)) {
            return ['-l']
        }

        return []
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
