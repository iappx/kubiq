import { inject, injectable } from 'tsyringe'
import { ClusterCatalogService } from '@/application/services/clusterCatalog/ClusterCatalogService'
import { ExecutableService } from '@/application/services/executable/ExecutableService'
import { ExternalTerminalCommand } from '@/application/services/localShell/models/ExternalTerminalCommand'
import { KubeconfigOverlay } from '@/application/services/localShell/models/KubeconfigOverlay'
import { LocalShellCommand } from '@/application/services/localShell/models/LocalShellCommand'
import type { TLocalShellPlan } from '@/application/services/localShell/types/TLocalShellPlan'
import { KubeconfigService } from '@/application/services/kubeconfig/KubeconfigService'
import { SettingsService } from '@/application/services/settings/SettingsService'
import { TerminalTools } from '@/application/services/terminal/constants/TerminalTools'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'
import { ProcessAdapter } from '@/infrastructure/process/ProcessAdapter'
import { AppHostAdapter } from '@/infrastructure/wails/AppHostAdapter'

@injectable()
export class LocalShellService {
    public static readonly shellVariable: string = 'SHELL'

    public static readonly kubeconfigVariable: string = 'KUBECONFIG'

    public static readonly pathVariable: string = 'PATH'

    public static readonly termVariable: string = 'TERM'

    public static readonly colorTermVariable: string = 'COLORTERM'

    public static readonly defaultTerm: string = 'xterm-256color'

    public static readonly defaultColorTerm: string = 'truecolor'

    constructor(
        @inject(SettingsService) private readonly settingsService: SettingsService,
        @inject(ExecutableService) private readonly executableService: ExecutableService,
        @inject(KubeconfigService) private readonly kubeconfigService: KubeconfigService,
        @inject(ClusterCatalogService) private readonly catalogService: ClusterCatalogService,
        @inject(EnvironmentAdapter) private readonly environment: EnvironmentAdapter,
        @inject(HostShellAdapter) private readonly host: HostShellAdapter,
        @inject(FileSystemTransport) private readonly files: FileSystemTransport,
        @inject(ProcessAdapter) private readonly processes: ProcessAdapter,
        @inject(AppHostAdapter) private readonly appHost: AppHostAdapter,
    ) {}

    public async prepare(clusterId: string, namespace: string): Promise<TLocalShellPlan> {
        const settings = await this.settingsService.read()
        const kubectl = await this.executableService.locate(TerminalTools.kubectl, settings.kubectlPath)
        const isWindows = await this.executableService.isWindows()
        const command = await this.shellCommand(isWindows, settings.terminalShell)

        return {
            command,
            args: LocalShellCommand.argsFor(command),
            env: await this.environmentFor(clusterId, namespace, kubectl.source === 'settings' ? kubectl.path : '', true),
            kubectl,
        }
    }

    public async launchExternal(clusterId: string, namespace: string): Promise<void> {
        const settings = await this.settingsService.read()
        const kubectl = await this.executableService.locate(TerminalTools.kubectl, settings.kubectlPath)
        const platform = await this.detectPlatform()
        const shellCommand = await this.shellCommand(platform === 'windows', settings.terminalShell)
        const shellArgs = LocalShellCommand.argsFor(shellCommand)
        const env = await this.environmentFor(clusterId, namespace, kubectl.source === 'settings' ? kubectl.path : '', false)
        const mode = settings.terminalMode === 'custom' ? 'custom' : 'system'
        const customCommand = mode === 'custom' ? await this.expandCustomTerminal(settings.externalTerminalCommand) : ''
        const detectedTerminal = mode === 'system' ? await this.detectSystemTerminal(platform) : ''

        const spec = ExternalTerminalCommand.build({
            platform,
            mode,
            customCommand,
            detectedTerminal,
            shellCommand,
            shellArgs,
            env,
        })

        await this.processes.launch(spec)
    }

    private async detectPlatform(): Promise<'windows' | 'darwin' | 'linux'> {
        const { os } = await this.appHost.platform()
        if (os === 'windows' || os === 'darwin' || os === 'linux') {
            return os
        }

        return await this.executableService.isWindows() ? 'windows' : 'linux'
    }

    private async detectSystemTerminal(platform: 'windows' | 'darwin' | 'linux'): Promise<string> {
        if (platform === 'darwin') {
            return ''
        }

        const candidates = platform === 'windows'
            ? ExternalTerminalCommand.windowsTerminalCandidates
            : ExternalTerminalCommand.linuxTerminalCandidates

        for (const candidate of candidates) {
            const located = await this.executableService.locate(candidate, '')
            if (located.source !== 'none' && located.path !== '') {
                return located.path
            }
        }

        return ''
    }

    // EnvService.Expand resolves bare names against the app directory, so only expand path-like custom commands.
    private async expandCustomTerminal(configured: string): Promise<string> {
        const trimmed = configured.trim()
        if (trimmed === '') {
            return ''
        }

        if (!/[\\/$%~]/.test(trimmed)) {
            return trimmed
        }

        return await this.environment.expand(trimmed) || trimmed
    }

    private async shellCommand(isWindows: boolean, configuredShell: string): Promise<string> {
        const configured = configuredShell.trim()
        if (configured !== '') {
            return await this.environment.expand(configured) || configured
        }

        if (isWindows) {
            const pwsh = await this.executableService.locate(LocalShellCommand.windowsPowerShellCore, '')

            return LocalShellCommand.commandFor(true, '', '', pwsh.path)
        }

        const preferred = await this.environment.get(LocalShellService.shellVariable)

        return LocalShellCommand.commandFor(false, preferred)
    }

    private async environmentFor(
        clusterId: string,
        namespace: string,
        kubectlPath: string,
        includeTerm: boolean,
    ): Promise<Record<string, string>> {
        const env: Record<string, string> = includeTerm
            ? {
                [LocalShellService.termVariable]: LocalShellService.defaultTerm,
                [LocalShellService.colorTermVariable]: LocalShellService.defaultColorTerm,
            }
            : {}

        const kubeconfig = await this.kubeconfig(clusterId, namespace)
        if (kubeconfig !== '') {
            env[LocalShellService.kubeconfigVariable] = kubeconfig
        }

        const search = await this.searchPath(kubectlPath)
        if (search !== '') {
            env[LocalShellService.pathVariable] = search
        }

        return env
    }

    private async kubeconfig(clusterId: string, namespace: string): Promise<string> {
        const sources = await this.catalogService.getSourcePaths()
        const files = await this.kubeconfigService.locate(sources)
        const separator = await this.environment.pathListSeparator()
        const overlay = await this.writeOverlay(clusterId, namespace, sources)

        return [...(overlay === '' ? [] : [overlay]), ...files].join(separator || ':')
    }

    private async writeOverlay(clusterId: string, namespace: string, sources: readonly string[]): Promise<string> {
        const contexts = await this.kubeconfigService.getContexts(sources)
        const context = contexts.find(candidate => candidate.name === clusterId)
        const path = KubeconfigOverlay.pathFor(clusterId)

        const document = KubeconfigOverlay.document({
            contextName: clusterId,
            clusterName: context?.clusterName ?? '',
            userName: context?.userName ?? '',
            namespace,
        })

        await this.files.send<null>({ path, operation: 'write', content: document })

        return this.host.absolutePath(path)
    }

    // A kubectl chosen in Settings is by definition not on PATH, and the shell needs it there.
    private async searchPath(kubectlPath: string): Promise<string> {
        if (kubectlPath === '') {
            return ''
        }

        const folder = kubectlPath.replace(/[\\/][^\\/]*$/, '')
        if (folder === '' || folder === kubectlPath) {
            return ''
        }

        const separator = await this.environment.pathListSeparator()
        const current = await this.environment.get(LocalShellService.pathVariable)

        return current === '' ? folder : `${folder}${separator || ':'}${current}`
    }
}
