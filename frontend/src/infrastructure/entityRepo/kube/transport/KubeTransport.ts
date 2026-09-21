import type { ITransport } from '@iappx/entity-repo'
import { HeaderReader, QueryStringSerializer, UrlJoiner } from '@iappx/entity-repo-rest'
import type { TRestHeaders, TRestRequest, TRestResponse } from '@iappx/entity-repo-rest'
import { KubeService, Request, Response } from '../../../../../bindings/iappx_k8s_admin/core/services/kube'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

export class KubeTransport implements ITransport<TRestRequest> {
    public static readonly jsonType: string = 'application/json'

    private readonly serializer = new QueryStringSerializer()

    constructor(
        private readonly sessionId: string,
        private readonly runtime: WailsRuntimeService,
    ) {}

    public get session(): string {
        return this.sessionId
    }

    public async send<TRes>(request: TRestRequest): Promise<TRes> {
        if (!this.runtime.isAvailable()) {
            return null as TRes
        }

        const path = this.path(request)
        const response = await this.call(path, request)

        if (!response.success) {
            throw KubeStatusReader.apiError(response.status, response.body, response.error)
        }

        const result: TRestResponse = {
            status: response.status,
            headers: KubeTransport.headers(response.headers),
            data: KubeTransport.parse(response.body),
        }

        return result as unknown as TRes
    }

    // The Go client appends this path to the server url verbatim, so the query string
    // has to travel inside it rather than as a field of its own.
    public path(request: TRestRequest): string {
        return UrlJoiner.withQuery(request.url, request.query ? this.serializer.serialize(request.query) : '')
    }

    protected async call(path: string, request: TRestRequest): Promise<Response> {
        try {
            return await KubeService.Send(this.payload(path, request))
        } catch (err) {
            throw new ApiError(KubeStatusReader.unreachable, err instanceof Error ? err.message : String(err))
        }
    }

    protected payload(path: string, request: TRestRequest): Request {
        const body = KubeTransport.body(request.body)
        const headers: TRestHeaders = { ...request.headers }
        if (body !== '' && !HeaderReader.get(headers, 'content-type')) {
            headers['content-type'] = KubeTransport.jsonType
        }

        return new Request({
            sessionId: this.sessionId,
            method: request.method,
            path,
            headers,
            body,
        })
    }

    protected static body(body: unknown): string {
        if (body === undefined || body === null) {
            return ''
        }
        return typeof body === 'string' ? body : JSON.stringify(body)
    }

    protected static parse(body: string): unknown {
        if (body === '') {
            return undefined
        }
        try {
            return JSON.parse(body)
        } catch {
            return body
        }
    }

    protected static headers(headers: { [_ in string]?: string }): TRestHeaders {
        const result: TRestHeaders = {}
        Object.keys(headers).forEach((name) => {
            result[name.toLowerCase()] = headers[name] ?? ''
        })
        return result
    }
}
