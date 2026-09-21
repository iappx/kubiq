import { KubeStreamSubscriptionBase } from '@/infrastructure/entityRepo/kube/transport/KubeStreamSubscriptionBase'
import type { IKubeChunkHandler } from '@/infrastructure/entityRepo/kube/transport/types/IKubeChunkHandler'
import type { TKubeWatchStatus } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchStatus'

export class KubeChunkSubscription extends KubeStreamSubscriptionBase {
    public static readonly interrupted: string = 'The connection to the cluster was interrupted while the stream was open'

    public static readonly unstoppable: string = 'Could not stop the stream'

    private readonly handler: IKubeChunkHandler

    constructor(handler: IKubeChunkHandler) {
        super()
        this.handler = handler
    }

    protected get stopFailure(): string {
        return KubeChunkSubscription.unstoppable
    }

    protected onChunk(chunk: string): void {
        this.handler.onChunk(chunk)
    }

    protected onFailure(details: string): void {
        this.handler.onFailure(KubeChunkSubscription.interrupted, details)
    }

    protected onClosed(status: TKubeWatchStatus): void {
        this.handler.onClose(status)
    }
}
