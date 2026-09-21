import type { TRestQueryParams } from '@iappx/entity-repo-rest'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeResourceRegistry } from '@/domain/models/kube'
import type { TPodLogOptions } from '@/domain/models/kube'
import type { TKubeStreamRequest } from '@/infrastructure/entityRepo/kube/transport/types/TKubeStreamRequest'

export class PodLogStreamRequest {
    public static readonly subresource: string = 'log'

    public static readonly unaddressable: string = 'This build does not know the Pod resource, so logs cannot be read'

    public static build(namespace: string, podName: string, options: TPodLogOptions): TKubeStreamRequest {
        return {
            path: PodLogStreamRequest.path(namespace, podName),
            params: PodLogStreamRequest.params(options),
        }
    }

    public static path(namespace: string, podName: string): string {
        const pods = KubeResourceRegistry.find('', 'pods')
        if (!pods) {
            throw new ApiError(PodLogStreamRequest.unaddressable, 'The resource registry carries no entry for core/pods')
        }

        return `${pods.objectPath(podName, namespace)}/${PodLogStreamRequest.subresource}`
    }

    public static params(options: TPodLogOptions): TRestQueryParams {
        const params: TRestQueryParams = {}

        if (options.container !== '') {
            params.container = options.container
        }
        if (options.follow) {
            params.follow = true
        }
        if (options.previous) {
            params.previous = true
        }
        if (options.timestamps) {
            params.timestamps = true
        }
        if (options.tailLines > 0) {
            params.tailLines = options.tailLines
        }

        // The API server rejects sinceTime and sinceSeconds together, so the precise one wins.
        if (options.sinceTime !== '') {
            params.sinceTime = options.sinceTime
        } else if (options.sinceSeconds > 0) {
            params.sinceSeconds = options.sinceSeconds
        }

        return params
    }
}
