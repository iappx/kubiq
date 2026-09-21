import { KubeStreamSubscriptionBase } from '@/infrastructure/entityRepo/kube/transport/KubeStreamSubscriptionBase'
import { KubeWatchEventReader } from '@/infrastructure/entityRepo/kube/transport/KubeWatchEventReader'
import type { IKubeWatchHandler } from '@/infrastructure/entityRepo/kube/transport/types/IKubeWatchHandler'
import type { TKubeWatchStatus } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchStatus'

export class KubeWatchSubscription extends KubeStreamSubscriptionBase {
    public static readonly interrupted: string = 'The connection to the cluster was interrupted while watching for changes'

    public static readonly unstoppable: string = 'Could not stop watching the cluster for changes'

    private readonly handler: IKubeWatchHandler

    constructor(handler: IKubeWatchHandler) {
        super()
        this.handler = handler
    }

    protected get stopFailure(): string {
        return KubeWatchSubscription.unstoppable
    }

    protected onChunk(chunk: string): void {
        const event = KubeWatchEventReader.read(chunk)
        if (event) {
            this.handler.onEvent(event)
        }
    }

    protected onFailure(details: string): void {
        this.handler.onEvent({
            type: 'error',
            message: KubeWatchSubscription.interrupted,
            details,
        })
    }

    protected onClosed(status: TKubeWatchStatus): void {
        this.handler.onClose(status)
    }
}
