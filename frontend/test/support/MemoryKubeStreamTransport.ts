import { QueryStringSerializer, UrlJoiner } from '@iappx/entity-repo-rest'
import type { IKubeChunkHandler } from '@/infrastructure/entityRepo/kube/transport/types/IKubeChunkHandler'
import type { TKubeStreamRequest } from '@/infrastructure/entityRepo/kube/transport/types/TKubeStreamRequest'
import type { TKubeWatchStatus } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchStatus'

export class MemoryKubeStream {
    public stopped = false

    constructor(private readonly handler: IKubeChunkHandler) {}

    public chunk(text: string): void {
        this.handler.onChunk(text)
    }

    public fail(message: string, details: string): void {
        this.handler.onFailure(message, details)
    }

    public end(status: TKubeWatchStatus): void {
        this.handler.onClose(status)
    }

    public async stop(): Promise<void> {
        this.stopped = true
    }
}

export class MemoryKubeStreamTransport {
    public readonly requests: TKubeStreamRequest[] = []

    public readonly streams: MemoryKubeStream[] = []

    public refusal: Error | null = null

    private readonly serializer = new QueryStringSerializer()

    public async open(request: TKubeStreamRequest, handler: IKubeChunkHandler): Promise<MemoryKubeStream> {
        this.requests.push(request)

        if (this.refusal) {
            throw this.refusal
        }

        const stream = new MemoryKubeStream(handler)
        this.streams.push(stream)

        return stream
    }

    public get last(): MemoryKubeStream {
        return this.streams[this.streams.length - 1]
    }

    public get path(): string {
        const request = this.requests[this.requests.length - 1]
        const query = request.params ? this.serializer.serialize(request.params) : ''

        return decodeURIComponent(UrlJoiner.withQuery(request.path, query))
    }

    public reset(): void {
        this.requests.length = 0
        this.streams.length = 0
        this.refusal = null
    }
}
