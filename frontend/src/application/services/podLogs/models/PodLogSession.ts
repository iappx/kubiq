import { PodLogBuffer } from '@/application/services/podLogs/models/PodLogBuffer'
import type { IPodLogSink } from '@/application/services/podLogs/types/IPodLogSink'
import type { TPodLogOpenRequest } from '@/application/services/podLogs/types/TPodLogOpenRequest'
import type { TPodLogOptions, TPodLogState } from '@/domain/models/kube'
import type { KubeChunkSubscription } from '@/infrastructure/entityRepo/kube/transport/KubeChunkSubscription'
import type { IKubeChunkHandler } from '@/infrastructure/entityRepo/kube/transport/types/IKubeChunkHandler'
import type { TKubeWatchStatus } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchStatus'
import type { IClusterStream } from '@/infrastructure/kube/types/IClusterStream'

export class PodLogSession implements IClusterStream, IKubeChunkHandler {
    public static readonly dropped: string = 'The cluster stopped sending this log'

    public readonly buffer = new PodLogBuffer()

    public readonly key: string

    public readonly clusterId: string

    public readonly namespace: string

    public readonly podName: string

    public readonly options: TPodLogOptions

    private readonly sink: IPodLogSink

    private subscription: KubeChunkSubscription | null = null

    private forget: (() => void) | null = null

    private state: TPodLogState = 'connecting'

    private failure: string = ''

    private disposed: boolean = false

    constructor(request: TPodLogOpenRequest, sink: IPodLogSink) {
        this.key = request.key
        this.clusterId = request.clusterId
        this.namespace = request.namespace
        this.podName = request.podName
        this.options = request.options
        this.sink = sink
    }

    public get label(): string {
        return this.options.container === ''
            ? this.podName
            : `${this.podName}/${this.options.container}`
    }

    public hold(forget: () => void): void {
        this.forget = forget
    }

    // The cluster can be disconnected while StartStream is still in flight, and a
    // subscription handed over after that has to be stopped, not kept.
    public attach(subscription: KubeChunkSubscription): void {
        if (this.disposed) {
            void subscription.stop()
            return
        }

        this.subscription = subscription
    }

    public onChunk(chunk: string): void {
        if (this.disposed) {
            return
        }

        // A container writing one long line would otherwise sit on "Connecting" while it streams.
        this.enter('streaming', '')

        if (this.buffer.append(chunk) > 0) {
            this.publish()
        }
    }

    public onFailure(message: string, details: string): void {
        this.failure = details === '' ? message : `${message}: ${details}`
    }

    // Kubernetes closes a followed log when the container it belongs to goes away,
    // so a clean end of a followed stream means the pod restarted under us.
    public onClose(status: TKubeWatchStatus): void {
        if (this.disposed) {
            return
        }

        this.buffer.flush()
        this.publish()

        if (status === 'error') {
            this.enter('failed', this.failure === '' ? PodLogSession.dropped : this.failure)
            return
        }

        this.enter(status === 'eof' && this.options.follow ? 'restarted' : 'ended', '')
    }

    public async stop(): Promise<void> {
        this.dispose()

        const subscription = this.subscription
        this.subscription = null

        if (subscription) {
            await subscription.stop()
        }
    }

    public dispose(): void {
        this.disposed = true
        this.forget?.()
        this.forget = null
    }

    private enter(state: TPodLogState, failure: string): void {
        if (this.state === state && this.failure === failure) {
            return
        }

        this.state = state
        this.failure = failure
        this.sink.onState(this.key, state, failure)
    }

    private publish(): void {
        this.sink.onLines(this.key, this.buffer.size, this.buffer.dropped)
    }
}
