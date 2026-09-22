import { inject, injectable } from 'tsyringe'
import { ClusterCatalogService } from '@/application/services/clusterCatalog/ClusterCatalogService'
import { ExecutableService } from '@/application/services/executable/ExecutableService'
import { KubeconfigOverlay } from '@/application/services/localShell/models/KubeconfigOverlay'
import { LocalShellCommand } from '@/application/services/localShell/models/LocalShellCommand'
import type { TLocalShellPlan } from '@/application/services/localShell/types/TLocalShellPlan'
import { KubeconfigService } from '@/application/services/kubeconfig/KubeconfigService'
import { SettingsService } from '@/application/services/settings/SettingsService'
import { TerminalTools } from '@/application/services/terminal/constants/TerminalTools'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'

@injectable()
export class LocalShellService {
    public static readonly shellVariable: string = 'SHELL'

    public static readonly kubeconfigVariable: string = 'KUBECONFIG'

    public static readonly pathVariable: string = 'PATH'

    constructor(
        @inject(SettingsService) private readonly settingsService: SettingsService,
        @inject(ExecutableService) private readonly executableService: ExecutableService,
        @inject(KubeconfigService) private readonly kubeconfigService: KubeconfigService,
        @inject(ClusterCatalogService) private readonly catalogService: ClusterCatalogService,
        @inject(EnvironmentAdapter) private readonly environment: EnvironmentAdapter,
        @inject(HostShellAdapter) private readonly host: HostShellAdapter,
        @inject(FileSystemTransport) private readonly files: FileSystemTransport,
    ) {}

    public async prepare(clusterId: string, namespace: string): Promise<TLocalShellPlan> {
        const settings = await this.settingsService.read()
        const kubectl = await this.executableService.locate(TerminalTools.kubectl, settings.kubectlPath)
        const isWindows = await this.executableService.isWindows()

        return {
            command: LocalShellCommand.commandFor(isWindows, await this.environment.get(LocalShellService.shellVariable)),
            args: LocalShellCommand.argsFor(isWindows),
            env: await this.environmentFor(clusterId, namespace, kubectl.source === 'settings' ? kubectl.path : ''),
            kubectl,
        }
    }

    private async environmentFor(clusterId: string, namespace: string, kubectlPath: string): Promise<Record<string, string>> {
        const env: Record<string, string> = {}

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
