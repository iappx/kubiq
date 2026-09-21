import { QueryStringSerializer, UrlJoiner } from '@iappx/entity-repo-rest'
import type { TRestQueryParams } from '@iappx/entity-repo-rest'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeResourceRegistry } from '@/domain/models/kube'

export class PodChannelPath {
    public static readonly resource: string = 'pods'

    public static readonly unknownKind: string = 'This build does not know the Pod resource'

    public static exec(namespace: string, podName: string, container: string, command: readonly string[]): string {
        const params = PodChannelPath.streams(container)
        params.command = [...command]

        return PodChannelPath.build(namespace, podName, 'exec', params)
    }

    public static attach(namespace: string, podName: string, container: string): string {
        return PodChannelPath.build(namespace, podName, 'attach', PodChannelPath.streams(container))
    }

    public static portForward(namespace: string, podName: string, remotePort: number): string {
        return PodChannelPath.build(namespace, podName, 'portforward', { ports: remotePort })
    }

    public static objectPath(namespace: string, podName: string): string {
        const kind = KubeResourceRegistry.find('', PodChannelPath.resource)
        if (!kind) {
            throw new ApiError(PodChannelPath.unknownKind, 'The resource registry has no entry for core/pods')
        }

        return kind.objectPath(podName, namespace)
    }

    // The API server refuses a stream that asks for both a TTY and a separate stderr,
    // so an interactive session multiplexes everything onto stdout.
    private static streams(container: string): TRestQueryParams {
        const params: TRestQueryParams = { stdin: true, stdout: true, stderr: false, tty: true }
        if (container !== '') {
            params.container = container
        }

        return params
    }

    private static build(namespace: string, podName: string, subresource: string, params: TRestQueryParams): string {
        const path = `${PodChannelPath.objectPath(namespace, podName)}/${subresource}`

        return UrlJoiner.withQuery(path, new QueryStringSerializer().serialize(params))
    }
}
