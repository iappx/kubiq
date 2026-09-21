import { inject, injectable } from 'tsyringe'
import type { TExecutableLocation } from '@/application/services/executable/types/TExecutableLocation'
import { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'

@injectable()
export class ExecutableService {
    public static readonly pathVariable: string = 'PATH'

    public static readonly extensionVariable: string = 'PATHEXT'

    public static readonly windowsSeparator: string = ';'

    public static readonly windowsExtensions: readonly string[] = ['.EXE', '.CMD', '.BAT', '.COM']

    constructor(
        @inject(EnvironmentAdapter) private readonly environment: EnvironmentAdapter,
        @inject(HostShellAdapter) private readonly host: HostShellAdapter,
    ) {}

    public async locate(name: string, configured: string = ''): Promise<TExecutableLocation> {
        const chosen = configured.trim()
        if (chosen !== '') {
            const expanded = await this.expand(chosen)

            return await this.host.exists(expanded)
                ? { name, path: expanded, source: 'settings' }
                : { name, path: '', source: 'none' }
        }

        const found = await this.search(name)

        return found === '' ? { name, path: '', source: 'none' } : { name, path: found, source: 'path' }
    }

    public async isWindows(): Promise<boolean> {
        return await this.environment.pathListSeparator() === ExecutableService.windowsSeparator
    }

    private async search(name: string): Promise<string> {
        const separator = await this.environment.pathListSeparator()
        const variable = await this.environment.get(ExecutableService.pathVariable)
        if (separator === '' || variable === '') {
            return ''
        }

        const extensions = await this.extensions(separator)
        const directories = variable.split(separator).map(entry => entry.trim()).filter(entry => entry !== '')

        for (const directory of directories) {
            for (const extension of extensions) {
                const candidate = ExecutableService.join(directory, name + extension)
                if (await this.host.exists(candidate)) {
                    return candidate
                }
            }
        }

        return ''
    }

    private async extensions(separator: string): Promise<string[]> {
        if (separator !== ExecutableService.windowsSeparator) {
            return ['']
        }

        const declared = (await this.environment.get(ExecutableService.extensionVariable))
            .split(ExecutableService.windowsSeparator)
            .map(entry => entry.trim())
            .filter(entry => entry.startsWith('.'))

        return declared.length > 0 ? declared : [...ExecutableService.windowsExtensions]
    }

    private async expand(path: string): Promise<string> {
        return await this.environment.expand(path) || path
    }

    private static join(directory: string, name: string): string {
        const separator = directory.includes('\\') ? '\\' : '/'

        return `${directory.replace(/[\\/]+$/, '')}${separator}${name}`
    }
}
