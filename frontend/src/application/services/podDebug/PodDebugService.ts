import { inject, injectable } from 'tsyringe'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { IdService } from '@/application/services/id/IdService'
import { PodDebugDefaults } from '@/application/services/podDebug/constants/PodDebugDefaults'
import { EphemeralContainerManifest } from '@/application/services/podDebug/models/EphemeralContainerManifest'
import type { TPodDebugRequest } from '@/application/services/podDebug/types/TPodDebugRequest'
import type { TPodDebugResult } from '@/application/services/podDebug/types/TPodDebugResult'
import { SettingsService } from '@/application/services/settings/SettingsService'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'
import { KubeHttpAdapter } from '@/infrastructure/kube/KubeHttpAdapter'

@injectable()
export class PodDebugService {
    public static readonly notConnected: string = 'That cluster is not connected'

    public static readonly missingImage: string = 'Enter a debug container image'

    public static readonly notReady: string = 'The debug container did not start'

    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(SettingsService) private readonly settingsService: SettingsService,
        @inject(IdService) private readonly idService: IdService,
        @inject(KubeHttpAdapter) private readonly http: KubeHttpAdapter,
    ) {}

    public defaultImage(): Promise<string> {
        return this.settingsService.nodeShellImage()
    }

    public async containersOf(clusterId: string, namespace: string, podName: string): Promise<string[]> {
        const pod = await this.connectionService.context(clusterId).pods
            .withPathParams({
                [KubeUrlBuilder.namespaceParam]: namespace,
                [KubeUrlBuilder.nameParam]: podName,
            })
            .getOne(podName)

        if (!pod) {
            return []
        }

        return (pod.spec?.containers ?? [])
            .map(container => container.name)
            .filter(name => name !== '')
    }

    public async attach(request: TPodDebugRequest, now: () => number = Date.now): Promise<TPodDebugResult> {
        const image = request.image.trim()
        if (image === '') {
            throw new ApiError(PodDebugService.missingImage)
        }

        const sessionId = this.session(request.clusterId)
        const containerName = EphemeralContainerManifest.nameFor(this.idService.next())
        const patch = await this.http.send(sessionId, {
            method: 'PATCH',
            url: EphemeralContainerManifest.patchPath(request.namespace, request.podName),
            headers: {
                'content-type': PodDebugDefaults.strategicMergePatchType,
            },
            body: EphemeralContainerManifest.patchDocument(containerName, image, request.targetContainerName),
        })

        PodDebugService.ensureSuccess(patch.status, patch.data)
        await this.waitRunning(sessionId, request.namespace, request.podName, containerName, now)

        return { containerName, image }
    }

    private async waitRunning(
        sessionId: string,
        namespace: string,
        podName: string,
        containerName: string,
        now: () => number,
    ): Promise<void> {
        const deadline = now() + PodDebugDefaults.readyTimeoutMs
        const podUrl = EphemeralContainerManifest.podPath(namespace, podName)

        for (;;) {
            const response = await this.http.send(sessionId, {
                method: 'GET',
                url: podUrl,
            })

            PodDebugService.ensureSuccess(response.status, response.data)

            const pod = PodDebugService.parsePod(response.data)
            const state = EphemeralContainerManifest.containerState(pod, containerName)

            if (state === 'running') {
                return
            }
            if (state === 'terminated') {
                const detail = EphemeralContainerManifest.containerDetail(pod, containerName)
                throw new ApiError(
                    PodDebugService.notReady,
                    detail || `Container ${containerName} in ${namespace}/${podName} terminated`,
                )
            }
            if (now() >= deadline) {
                const detail = EphemeralContainerManifest.containerDetail(pod, containerName)
                throw new ApiError(
                    PodDebugService.notReady,
                    detail || `Container ${containerName} in ${namespace}/${podName} was still waiting after ${PodDebugDefaults.readyTimeoutMs / 1000}s`,
                )
            }

            await PodDebugService.pause(PodDebugDefaults.pollIntervalMs)
        }
    }

    private session(clusterId: string): string {
        const connection = this.connectionService.connection(clusterId)
        if (!connection) {
            throw new ApiError(
                PodDebugService.notConnected,
                `No open session for "${clusterId}" — connect to it from the cluster catalog first`,
            )
        }

        return connection.sessionId
    }

    private static ensureSuccess(status: number, body: string): void {
        if (status >= 200 && status < 300) {
            return
        }

        throw KubeStatusReader.apiError(status, body, '')
    }

    private static parsePod(body: string): Record<string, unknown> {
        if (body === '') {
            return {}
        }
        try {
            const parsed = JSON.parse(body) as unknown
            return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
                ? parsed as Record<string, unknown>
                : {}
        } catch {
            return {}
        }
    }

    private static pause(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}
