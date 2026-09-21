import { QueryStringSerializer, UrlJoiner } from '@iappx/entity-repo-rest'
import type { ITransport } from '@iappx/entity-repo'
import type { TRestRequest, TRestResponse } from '@iappx/entity-repo-rest'

export class MemoryKubeTransport implements ITransport<TRestRequest> {
    public readonly requests: TRestRequest[] = []

    private readonly answers: (TRestResponse | Error)[] = []

    private readonly serializer = new QueryStringSerializer()

    public answerWith(data: unknown, status: number = 200): void {
        this.answers.push({ status, headers: {}, data })
    }

    public failWith(error: Error): void {
        this.answers.push(error)
    }

    public async send<TRes>(request: TRestRequest): Promise<TRes> {
        this.requests.push(request)
        const answer = this.answers.shift() ?? { status: 200, headers: {}, data: undefined }
        if (answer instanceof Error) {
            throw answer
        }
        return answer as unknown as TRes
    }

    public get last(): TRestRequest {
        return this.requests[this.requests.length - 1]
    }

    public get path(): string {
        const request = this.last
        const query = request.query ? this.serializer.serialize(request.query) : ''
        return decodeURIComponent(UrlJoiner.withQuery(request.url, query))
    }

    public reset(): void {
        this.requests.length = 0
        this.answers.length = 0
    }
}
