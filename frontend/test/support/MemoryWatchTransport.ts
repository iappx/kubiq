import { MemoryKubeWatch } from './MemoryKubeWatch'
import type { IKubeWatchHandler } from '@/infrastructure/entityRepo/kube/transport/types/IKubeWatchHandler'
import type { TKubeWatchRequest } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchRequest'

export class MemoryWatchTransport {
    public readonly requests: TKubeWatchRequest[] = []

    public readonly opened: MemoryKubeWatch[] = []

    public failure: Error | undefined

    public async watch(request: TKubeWatchRequest, handler: IKubeWatchHandler): Promise<MemoryKubeWatch> {
        this.requests.push(request)
        if (this.failure) {
            throw this.failure
        }

        const subscription = new MemoryKubeWatch(handler)
        this.opened.push(subscription)

        return subscription
    }

    public get last(): MemoryKubeWatch {
        return this.opened[this.opened.length - 1]
    }

    public get lastRequest(): TKubeWatchRequest {
        return this.requests[this.requests.length - 1]
    }

    public get liveCount(): number {
        return this.opened.filter(subscription => !subscription.stopped).length
    }

    public reset(): void {
        this.requests.length = 0
        this.opened.length = 0
        this.failure = undefined
    }
}
