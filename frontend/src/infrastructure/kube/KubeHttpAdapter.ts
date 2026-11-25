import { inject, singleton } from 'tsyringe'
import type { TRestHeaders, TRestRequest, TRestResponse } from '@iappx/entity-repo-rest'
import { KubeService, Request } from '../../../bindings/iappx_k8s_admin/core/services/kube'
import { ApiError } from '@/domain/errors/ApiError'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class KubeHttpAdapter {
    private static readonly RequestFailed = 'HTTP request failed'

    private static readonly NoRuntime = 'HTTP requests need the desktop application'

    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    public async send(sessionId: string, request: TRestRequest): Promise<TRestResponse<string>> {
        if (!this.runtime.isAvailable()) {
            throw new ApiError(KubeHttpAdapter.NoRuntime, 'The Wails runtime is not available')
        }

        let response
        try {
            response = await KubeService.Send(new Request({
                sessionId,
                method: request.method,
                path: request.url,
                headers: { ...request.headers },
                body: KubeHttpAdapter.bodyOf(request.body),
                timeoutSeconds: 0,
            }))
        } catch (err) {
            throw new ApiError(
                KubeHttpAdapter.RequestFailed,
                err instanceof Error ? err.message : String(err),
            )
        }

        if (!response.success && response.status === 0) {
            throw new ApiError(
                KubeHttpAdapter.RequestFailed,
                response.error || 'No response from server',
                0,
            )
        }

        return {
            status: response.status,
            headers: KubeHttpAdapter.headersOf(response.headers),
            data: response.body,
        }
    }

    private static bodyOf(body: unknown): string {
        if (body === undefined || body === null) {
            return ''
        }

        return typeof body === 'string' ? body : JSON.stringify(body)
    }

    private static headersOf(headers: { [_ in string]?: string }): TRestHeaders {
        const result: TRestHeaders = {}
        Object.keys(headers).forEach((name) => {
            result[name.toLowerCase()] = headers[name] ?? ''
        })
        return result
    }
}
