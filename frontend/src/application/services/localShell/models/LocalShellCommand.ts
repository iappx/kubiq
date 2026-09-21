export class LocalShellCommand {
    public static readonly windowsShell: string = 'powershell.exe'

    public static readonly unixShell: string = '/bin/bash'

    public static commandFor(isWindows: boolean, preferred: string): string {
        if (isWindows) {
            return LocalShellCommand.windowsShell
        }

        return preferred.trim() === '' ? LocalShellCommand.unixShell : preferred.trim()
    }

    public static argsFor(isWindows: boolean): string[] {
        return isWindows ? ['-NoLogo'] : ['-l']
    }
}
