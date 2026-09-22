import { inject, singleton } from 'tsyringe'
import { ConnectionService } from '../../../bindings/iappx_k8s_admin/core/services/kube'
import { ConnectionSpec } from '../../../bindings/iappx_k8s_admin/core/services/kube/models'
import { ApiError } from '@/domain/errors/ApiError'
import type { TConnectionSpec } from '@/domain/entities/kubeconfig'
import type { TKubeSession } from '@/infrastructure/kube/types/TKubeSession'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class KubeSessionAdapter {
    private static readonly ConnectFailed = 'Could not connect to the cluster'

    private static readonly NoRuntime = 'Connecting to a cluster needs the desktop application'

    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    public async connect(spec: TConnectionSpec, label: string): Promise<string> {
        if (!this.runtime.isAvailable()) {
            throw new ApiError(KubeSessionAdapter.NoRuntime, 'The Wails runtime is not available')
        }

        const result = await this.call(
            () => ConnectionService.Connect(new ConnectionSpec({ ...spec, label })),
            KubeSessionAdapter.ConnectFailed,
        )

        if (!result.success || !result.sessionId) {
            throw new ApiError(KubeSessionAdapter.ConnectFailed, result.error)
        }

        return result.sessionId
    }

    public async disconnect(id: string): Promise<void> {
        if (!this.runtime.isAvailable()) {
            return
        }

        const message = 'Could not close the cluster connection'
        const result = await this.call(() => ConnectionService.Disconnect(id), message)

        if (!result.success) {
            throw new ApiError(message, result.error)
        }
    }

    public async sessions(): Promise<TKubeSession[]> {
        if (!this.runtime.isAvailable()) {
            return []
        }

        const result = await this.call(
            () => ConnectionService.Sessions(),
            'Could not read the open cluster connections',
        )

        if (!result.success) {
            return []
        }

        return result.sessions.map(session => ({
            id: session.id,
            label: session.label,
            server: session.server,
            createdAt: session.createdAt,
        }))
    }

    private async call<T>(action: () => Promise<T>, message: string): Promise<T> {
        try {
            return await action()
        } catch (err) {
            throw new ApiError(message, err instanceof Error ? err.message : String(err))
        }
    }
}
