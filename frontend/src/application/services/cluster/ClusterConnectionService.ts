import { inject, injectable } from 'tsyringe'
import { KubeconfigService } from '@/application/services/kubeconfig/KubeconfigService'
import type { TClusterContextInfo } from '@/application/services/cluster/types/TClusterContextInfo'
import { KubeSessionAdapter } from '@/infrastructure/kube/KubeSessionAdapter'
import type { TKubeSession } from '@/infrastructure/kube/types/TKubeSession'

@injectable()
export class ClusterConnectionService {
    constructor(
        @inject(KubeconfigService) private readonly kubeconfigService: KubeconfigService,
        @inject(KubeSessionAdapter) private readonly sessionAdapter: KubeSessionAdapter,
    ) {}

    public async listContexts(extraPath?: string): Promise<TClusterContextInfo[]> {
        const [contexts, currentName] = await Promise.all([
            this.kubeconfigService.getContexts(extraPath),
            this.kubeconfigService.getCurrentContextName(extraPath),
        ])

        return contexts.map(context => ({
            name: context.name,
            filePath: context.filePath,
            clusterName: context.clusterName,
            server: context.server,
            namespace: context.effectiveNamespace,
            authType: context.authType,
            isCurrent: context.name === currentName,
            isSupported: context.isSupported,
            unsupportedReason: context.unsupportedReason,
        }))
    }

    public async connect(contextName: string, extraPath?: string): Promise<string> {
        const spec = await this.kubeconfigService.buildConnectionSpec(contextName, extraPath)
        return this.sessionAdapter.connect(spec)
    }

    public disconnect(sessionId: string): Promise<void> {
        return this.sessionAdapter.disconnect(sessionId)
    }

    public sessions(): Promise<TKubeSession[]> {
        return this.sessionAdapter.sessions()
    }
}
