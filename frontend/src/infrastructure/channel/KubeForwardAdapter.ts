import { inject, singleton } from 'tsyringe'
import { ChannelService, PortForwardSpec } from '../../../bindings/iappx_k8s_admin/core/services/channel'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeForwardSubscription } from '@/infrastructure/channel/KubeForwardSubscription'
import type { IKubeForwardHandler } from '@/infrastructure/channel/types/IKubeForwardHandler'
import type { TKubeForwardHandle } from '@/infrastructure/channel/types/TKubeForwardHandle'
import type { TKubeForwardSpec } from '@/infrastructure/channel/types/TKubeForwardSpec'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class KubeForwardAdapter {
    public static readonly forwardProtocol: string = 'v4.channel.k8s.io'

    public static readonly loopback: string = '127.0.0.1'

    public static readonly unopenable: string = 'Could not start the port forward'

    public static readonly unavailable: string = 'Port forwarding needs the desktop application'

    private readonly open = new Map<string, KubeForwardSubscription>()

    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    public get isAvailable(): boolean {
        return this.runtime.isAvailable()
    }

    public async start(spec: TKubeForwardSpec, handler: IKubeForwardHandler): Promise<TKubeForwardHandle> {
        if (!this.isAvailable) {
            throw new ApiError(KubeForwardAdapter.unavailable, 'No native bridge is present in this window')
        }

        const subscription = new KubeForwardSubscription(handler)
        subscription.listen()

        let result
        try {
            result = await ChannelService.StartForward(new PortForwardSpec({
                sessionId: spec.sessionId,
                path: spec.path,
                subprotocols: spec.subprotocols ?? [KubeForwardAdapter.forwardProtocol],
                headers: {},
                localPort: spec.localPort ?? 0,
                localAddress: spec.localAddress ?? KubeForwardAdapter.loopback,
                remotePort: spec.remotePort,
            }))
        } catch (err) {
            subscription.cancel()
            throw new ApiError(KubeForwardAdapter.unopenable, err instanceof Error ? err.message : String(err))
        }

        if (!result.success || result.forwardId === '') {
            subscription.cancel()
            throw new ApiError(KubeForwardAdapter.unopenable, result.error)
        }

        subscription.attach(result.forwardId)
        this.open.set(result.forwardId, subscription)

        return { forwardId: result.forwardId, localPort: result.localPort }
    }

    public async stop(forwardId: string): Promise<void> {
        const subscription = this.open.get(forwardId)
        this.open.delete(forwardId)
        subscription?.cancel()

        if (forwardId === '' || !this.isAvailable) {
            return
        }

        try {
            await ChannelService.StopForward(forwardId)
        } catch {
            return
        }
    }
}
