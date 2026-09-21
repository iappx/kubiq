import { QueryStringSerializer, UrlJoiner } from '@iappx/entity-repo-rest'
import type { TRestQueryParams } from '@iappx/entity-repo-rest'
import { KubeService, StreamRequest, StreamResult } from '../../../../../bindings/iappx_k8s_admin/core/services/kube'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeApiParams } from '@/infrastructure/entityRepo/kube/KubeApiParams'
import { KubeChunkSubscription } from '@/infrastructure/entityRepo/kube/transport/KubeChunkSubscription'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'
import type { KubeStreamSubscriptionBase } from '@/infrastructure/entityRepo/kube/transport/KubeStreamSubscriptionBase'
import { KubeWatchSubscription } from '@/infrastructure/entityRepo/kube/transport/KubeWatchSubscription'
import type { IKubeChunkHandler } from '@/infrastructure/entityRepo/kube/transport/types/IKubeChunkHandler'
import type { IKubeWatchHandler } from '@/infrastructure/entityRepo/kube/transport/types/IKubeWatchHandler'
import type { TKubeStreamRequest } from '@/infrastructure/entityRepo/kube/transport/types/TKubeStreamRequest'
import type { TKubeWatchRequest } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchRequest'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

export class KubeStreamTransport {
    public static readonly lineMode: string = 'lines'

    // Raw mode hands over 32 KiB blocks instead of one bridge event per line, which a
    // pod logging thousands of lines a second would flood.
    public static readonly rawMode: string = 'raw'

    public static readonly unwatchable: string = 'Could not watch the cluster for changes'

    public static readonly unreadable: string = 'Could not open the stream'

    private readonly serializer = new QueryStringSerializer()

    constructor(
        private readonly sessionId: string,
        private readonly runtime: WailsRuntimeService,
    ) {}

    public get session(): string {
        return this.sessionId
    }

    public watch(request: TKubeWatchRequest, handler: IKubeWatchHandler): Promise<KubeWatchSubscription> {
        return this.begin(
            new KubeWatchSubscription(handler),
            this.path(request),
            KubeStreamTransport.lineMode,
            KubeStreamTransport.unwatchable,
        )
    }

    public open(request: TKubeStreamRequest, handler: IKubeChunkHandler): Promise<KubeChunkSubscription> {
        return this.begin(
            new KubeChunkSubscription(handler),
            this.streamPath(request),
            KubeStreamTransport.rawMode,
            KubeStreamTransport.unreadable,
        )
    }

    public path(request: TKubeWatchRequest): string {
        return UrlJoiner.withQuery(request.path, this.serializer.serialize(KubeStreamTransport.params(request)))
    }

    public streamPath(request: TKubeStreamRequest): string {
        return UrlJoiner.withQuery(request.path, this.serializer.serialize(request.params ?? {}))
    }

    protected async begin<T extends KubeStreamSubscriptionBase>(
        subscription: T,
        path: string,
        mode: string,
        failure: string,
    ): Promise<T> {
        if (!this.runtime.isAvailable()) {
            return subscription
        }

        // Must precede StartStream: the first chunks are emitted while its answer is
        // still on its way back over the bridge.
        subscription.listen()

        const result = await this.start(path, mode)
        if (!result.success || result.streamId === '') {
            subscription.cancel()
            throw new ApiError(failure, result.error)
        }

        subscription.attach(result.streamId)

        return subscription
    }

    protected async start(path: string, mode: string): Promise<StreamResult> {
        try {
            return await KubeService.StartStream(new StreamRequest({
                sessionId: this.sessionId,
                method: 'GET',
                path,
                mode,
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
