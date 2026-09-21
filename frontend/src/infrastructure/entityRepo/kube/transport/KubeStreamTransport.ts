import { QueryStringSerializer, UrlJoiner } from '@iappx/entity-repo-rest'
import type { TRestQueryParams } from '@iappx/entity-repo-rest'
import { KubeService, StreamRequest, StreamResult } from '../../../../../bindings/iappx_k8s_admin/core/services/kube'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeApiParams } from '@/infrastructure/entityRepo/kube/KubeApiParams'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'
import { KubeWatchSubscription } from '@/infrastructure/entityRepo/kube/transport/KubeWatchSubscription'
import type { IKubeWatchHandler } from '@/infrastructure/entityRepo/kube/transport/types/IKubeWatchHandler'
import type { TKubeWatchRequest } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchRequest'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

export class KubeStreamTransport {
    public static readonly lineMode: string = 'lines'

    public static readonly unwatchable: string = 'Could not watch the cluster for changes'

    private readonly serializer = new QueryStringSerializer()

    constructor(
        private readonly sessionId: string,
        private readonly runtime: WailsRuntimeService,
    ) {}

    public get session(): string {
        return this.sessionId
    }

    public async watch(request: TKubeWatchRequest, handler: IKubeWatchHandler): Promise<KubeWatchSubscription> {
        const subscription = new KubeWatchSubscription(handler)
        if (!this.runtime.isAvailable()) {
            return subscription
        }

        // Listening starts before the stream does: the first lines are emitted
        // while StartStream is still on its way back over the bridge.
        subscription.listen()

        const result = await this.start(request)
        if (!result.success || result.streamId === '') {
            subscription.cancel()
            throw new ApiError(KubeStreamTransport.unwatchable, result.error)
        }

        subscription.attach(result.streamId)

        return subscription
    }

    public path(request: TKubeWatchRequest): string {
        return UrlJoiner.withQuery(request.path, this.serializer.serialize(KubeStreamTransport.params(request)))
    }

    protected async start(request: TKubeWatchRequest): Promise<StreamResult> {
        try {
            return await KubeService.StartStream(new StreamRequest({
                sessionId: this.sessionId,
                method: 'GET',
                path: this.path(request),
                mode: KubeStreamTransport.lineMode,
            }))
        } catch (err) {
            throw new ApiError(KubeStatusReader.unreachable, err instanceof Error ? err.message : String(err))
        }
    }

    protected static params(request: TKubeWatchRequest): TRestQueryParams {
        const params: TRestQueryParams = {
            [KubeApiParams.watch]: true,
            [KubeApiParams.allowWatchBookmarks]: request.allowWatchBookmarks !== false,
        }
        if (request.resourceVersion !== undefined && request.resourceVersion !== '') {
            params[KubeApiParams.resourceVersion] = request.resourceVersion
        }
        if (request.labelSelector !== undefined && request.labelSelector !== '') {
            params[KubeApiParams.labelSelector] = request.labelSelector
        }
        if (request.fieldSelector !== undefined && request.fieldSelector !== '') {
            params[KubeApiParams.fieldSelector] = request.fieldSelector
        }
        return params
    }
}
