import { inject, singleton } from 'tsyringe'
import { ClipboardService } from '@/application/services/clipboard/ClipboardService'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { PodLogArchive } from '@/application/services/podLogs/models/PodLogArchive'
import { PodLogSession } from '@/application/services/podLogs/models/PodLogSession'
import { PodLogStreamRequest } from '@/application/services/podLogs/models/PodLogStreamRequest'
import type { IPodLogSink } from '@/application/services/podLogs/types/IPodLogSink'
import type { TPodLogOpenRequest } from '@/application/services/podLogs/types/TPodLogOpenRequest'
import type { TPodLogContainer } from '@/domain/models/kube'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'

@singleton()
export class PodLogsService {
    private readonly sessions = new Map<string, PodLogSession>()

    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(ClipboardService) private readonly clipboardService: ClipboardService,
        @inject(FileSystemTransport) private readonly files: FileSystemTransport,
    ) {}

    public async open(request: TPodLogOpenRequest, sink: IPodLogSink): Promise<void> {
        await this.close(request.key)

        const session = new PodLogSession(request, sink)
        this.sessions.set(request.key, session)

        // Registered before the stream is asked for: a cluster disconnected while
        // StartStream is in flight has to be able to reach this session too.
        session.hold(this.connectionService.registerStream(request.clusterId, session))

        try {
            const subscription = await this.connectionService
                .stream(request.clusterId)
                .open(PodLogStreamRequest.build(request.namespace, request.podName, request.options), session)

            session.attach(subscription)
        } catch (err) {
            this.sessions.delete(request.key)
            session.dispose()
            throw err
        }
    }

    public async close(key: string): Promise<void> {
        const session = this.sessions.get(key)
        if (!session) {
            return
        }

        this.sessions.delete(key)
        await session.stop()
    }

    public async closeCluster(clusterId: string): Promise<void> {
        const keys = [...this.sessions.values()]
            .filter(session => session.clusterId === clusterId)
            .map(session => session.key)

        await Promise.allSettled(keys.map(key => this.close(key)))
    }

    public has(key: string): boolean {
        return this.sessions.has(key)
    }

    public lines(key: string): readonly string[] {
        return this.sessions.get(key)?.buffer.lines ?? []
    }

    public text(key: string): string {
        return this.sessions.get(key)?.buffer.text() ?? ''
    }

    public async containers(clusterId: string, namespace: string, podName: string): Promise<TPodLogContainer[]> {
        const pod = await this.connectionService.context(clusterId).pods
            .withPathParams({
                [KubeUrlBuilder.namespaceParam]: namespace,
                [KubeUrlBuilder.nameParam]: podName,
            })
            .getOne(podName)

        if (!pod) {
            return []
        }

        return [
            ...(pod.spec?.initContainers ?? []).map(container => ({ name: container.name, isInit: true })),
            ...(pod.spec?.containers ?? []).map(container => ({ name: container.name, isInit: false })),
        ].filter(container => container.name !== '')
    }

    public async save(key: string, at: Date = new Date()): Promise<string> {
        const session = this.sessions.get(key)
        if (!session) {
            return ''
        }

        const path = PodLogArchive.pathFor(session.namespace, session.podName, session.options.container, at)
        await this.files.send<null>({ path, operation: 'write', content: session.buffer.text() })

        return path
    }

    public copy(key: string): Promise<void> {
        return this.clipboardService.write(this.text(key))
    }
}
