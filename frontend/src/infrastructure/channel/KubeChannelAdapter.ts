import { inject, singleton } from 'tsyringe'
import { ChannelService, ChannelSpec } from '../../../bindings/iappx_k8s_admin/core/services/channel'
import { TerminalBytes } from '@/domain/models/terminal'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeChannelSubscription } from '@/infrastructure/channel/KubeChannelSubscription'
import type { IKubeChannelHandler } from '@/infrastructure/channel/types/IKubeChannelHandler'
import type { TKubeChannelSpec } from '@/infrastructure/channel/types/TKubeChannelSpec'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class KubeChannelAdapter {
    public static readonly execProtocol: string = 'v5.channel.k8s.io'

    public static readonly unopenable: string = 'Could not open a channel to the cluster'

    public static readonly unwritable: string = 'Could not send input to the session'

    private readonly open = new Map<string, KubeChannelSubscription>()

    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    public get isAvailable(): boolean {
        return this.runtime.isAvailable()
    }

    public async connect(spec: TKubeChannelSpec, handler: IKubeChannelHandler): Promise<string> {
        if (!this.isAvailable) {
            return ''
        }

        const subscription = new KubeChannelSubscription(handler)
        subscription.listen()

        const result = await this.call(
            () => ChannelService.Open(new ChannelSpec({
                sessionId: spec.sessionId,
                path: spec.path,
                subprotocols: spec.subprotocols ?? [KubeChannelAdapter.execProtocol],
                headers: {},
                tty: spec.tty === true,
                cols: spec.cols ?? 0,
                rows: spec.rows ?? 0,
            })),
            KubeChannelAdapter.unopenable,
        )

        if (!result.success || result.channelId === '') {
            subscription.cancel()
            throw new ApiError(KubeChannelAdapter.unopenable, result.error)
        }

        subscription.attach(result.channelId)
        this.open.set(result.channelId, subscription)

        return result.channelId
    }

    public async write(channelId: string, data: Uint8Array): Promise<void> {
        if (channelId === '' || !this.isAvailable) {
            return
        }

        const result = await this.call(
            () => ChannelService.Write(channelId, TerminalBytes.encode(data)),
            KubeChannelAdapter.unwritable,
        )

        if (!result.success) {
            throw new ApiError(KubeChannelAdapter.unwritable, result.error)
        }
    }

    public async resize(channelId: string, cols: number, rows: number): Promise<void> {
        if (channelId === '' || !this.isAvailable) {
            return
        }

        // A size the cluster rejects is not worth interrupting a working session for.
        try {
            await ChannelService.Resize(channelId, cols, rows)
        } catch {
            return
        }
    }

    public async close(channelId: string): Promise<void> {
        const subscription = this.open.get(channelId)
        this.open.delete(channelId)
        subscription?.cancel()

        if (channelId === '' || !this.isAvailable) {
            return
        }

        try {
            await ChannelService.Close(channelId)
        } catch {
            return
        }
    }

    private async call<T>(action: () => Promise<T>, message: string): Promise<T> {
        try {
            return await action()
        } catch (err) {
            throw new ApiError(message, err instanceof Error ? err.message : String(err))
        }
    }
}
