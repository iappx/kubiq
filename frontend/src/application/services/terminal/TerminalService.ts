import { inject, singleton } from 'tsyringe'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { LocalShellService } from '@/application/services/localShell/LocalShellService'
import { NodeShellDefaults } from '@/application/services/nodeShell/constants/NodeShellDefaults'
import { NodeShellService } from '@/application/services/nodeShell/NodeShellService'
import type { TNodeShellPod } from '@/application/services/nodeShell/types/TNodeShellPod'
import { TerminalLimits } from '@/application/services/terminal/constants/TerminalLimits'
import { TerminalTools } from '@/application/services/terminal/constants/TerminalTools'
import { ChannelTerminalSession } from '@/application/services/terminal/models/ChannelTerminalSession'
import { PtyTerminalSession } from '@/application/services/terminal/models/PtyTerminalSession'
import type { TerminalSession } from '@/application/services/terminal/models/TerminalSession'
import type { ITerminalSink } from '@/application/services/terminal/types/ITerminalSink'
import type { TExecTerminalRequest } from '@/application/services/terminal/types/TExecTerminalRequest'
import type { TLocalTerminalRequest } from '@/application/services/terminal/types/TLocalTerminalRequest'
import type { TNodeTerminalRequest } from '@/application/services/terminal/types/TNodeTerminalRequest'
import { ApiError } from '@/domain/errors/ApiError'
import { PodShellCommand } from '@/domain/models/terminal'
import type { TTerminalContainer } from '@/domain/models/terminal'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'
import { KubeChannelAdapter } from '@/infrastructure/channel/KubeChannelAdapter'
import { PodChannelPath } from '@/infrastructure/channel/PodChannelPath'
import type { TKubeChannelSpec } from '@/infrastructure/channel/types/TKubeChannelSpec'
import { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'
import { PtyAdapter } from '@/infrastructure/process/PtyAdapter'

@singleton()
export class TerminalService {
    public static readonly desktopOnly: string = 'Terminals are only available in the desktop application'

    public static readonly notConnected: string = 'That cluster is not connected'

    private readonly sessions = new Map<string, TerminalSession>()

    private readonly nodePods = new Map<string, TNodeShellPod>()

    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(LocalShellService) private readonly localShellService: LocalShellService,
        @inject(NodeShellService) private readonly nodeShellService: NodeShellService,
        @inject(KubeChannelAdapter) private readonly channels: KubeChannelAdapter,
        @inject(PtyAdapter) private readonly ptys: PtyAdapter,
        @inject(HostShellAdapter) private readonly host: HostShellAdapter,
    ) {}

    public openLink(url: string): Promise<void> {
        return this.host.openUri(url)
    }

    public listNodes(clusterId: string): Promise<string[]> {
        return this.nodeShellService.listNodes(clusterId)
    }

    public async containers(clusterId: string, namespace: string, podName: string): Promise<TTerminalContainer[]> {
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

    public async openExec(key: string, request: TExecTerminalRequest, sink: ITerminalSink): Promise<void> {
        const session = this.begin(new ChannelTerminalSession(key, request.clusterId, 'exec', sink, this.channels))

        const sessionId = this.channelSession(session, request.clusterId)
        if (sessionId === '') {
            return
        }

        await this.guard(session, async () => {
            const path = PodChannelPath.exec(
                request.namespace,
                request.podName,
                request.containerName,
                PodShellCommand.argv(),
            )

            session.attach(await this.channels.connect(TerminalService.channelSpec(sessionId, path), session))
        })
    }

    public async openNodeShell(key: string, request: TNodeTerminalRequest, sink: ITerminalSink): Promise<void> {
        const session = this.begin(new ChannelTerminalSession(key, request.clusterId, 'node', sink, this.channels))

        const sessionId = this.channelSession(session, request.clusterId)
        if (sessionId === '') {
            return
        }

        await this.guard(session, async () => {
            // Only the pods of shells this window is not holding open are stale.
            await this.nodeShellService.sweep(request.clusterId, this.livePods(request.clusterId))

            const pod = await this.nodeShellService.create(request.clusterId, request.nodeName)
            this.nodePods.set(key, pod)
            session.onCleanup(() => {
                this.nodePods.delete(key)
                return this.nodeShellService.remove(request.clusterId, pod)
            })

            await this.nodeShellService.waitReady(request.clusterId, pod)

            const path = PodChannelPath.attach(pod.namespace, pod.name, NodeShellDefaults.containerName)

            session.attach(await this.channels.connect(TerminalService.channelSpec(sessionId, path), session))
        })
    }

    public async openLocalShell(key: string, request: TLocalTerminalRequest, sink: ITerminalSink): Promise<void> {
        const session = this.begin(new PtyTerminalSession(key, request.clusterId, 'local', sink, this.ptys))

        if (!this.ptys.isAvailable) {
            session.fail(TerminalService.desktopOnly, 'desktop')
            return
        }

        await this.guard(session, async () => {
            const plan = await this.localShellService.prepare(request.clusterId, request.namespace)
            if (plan.kubectl.source === 'none') {
                session.fail(TerminalTools.kubectlMissing, 'kubectl')
                return
            }

            session.attach(await this.ptys.start({
                command: plan.command,
                args: plan.args,
                env: plan.env,
                cols: TerminalLimits.defaultCols,
                rows: TerminalLimits.defaultRows,
            }, session))
        })
    }

    public async write(key: string, data: Uint8Array): Promise<void> {
        await this.sessions.get(key)?.write(data)
    }

    public async resize(key: string, cols: number, rows: number): Promise<void> {
        await this.sessions.get(key)?.resize(cols, rows)
    }

    public attachView(key: string, write: (data: Uint8Array) => void): void {
        this.sessions.get(key)?.attachView(write)
    }

    public detachView(key: string): void {
        this.sessions.get(key)?.detachView()
    }

    public has(key: string): boolean {
        return this.sessions.has(key)
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

    public async closeAll(): Promise<void> {
        const keys = [...this.sessions.keys()]

        await Promise.allSettled(keys.map(key => this.close(key)))
    }

    private livePods(clusterId: string): string[] {
        return [...this.nodePods.entries()]
            .filter(([key]) => this.sessions.get(key)?.clusterId === clusterId)
            .map(([, pod]) => pod.name)
    }

    private begin<T extends TerminalSession>(session: T): T {
        const known = this.sessions.get(session.key)
        if (known) {
            this.sessions.delete(session.key)
            void known.stop()
        }

        this.sessions.set(session.key, session)

        // Registered before anything is asked for: a cluster disconnected while the pod is
        // still being created has to be able to reach this session too.
        session.hold(this.connectionService.registerStream(session.clusterId, session))

        return session
    }

    private channelSession(session: TerminalSession, clusterId: string): string {
        if (!this.channels.isAvailable) {
            session.fail(TerminalService.desktopOnly, 'desktop')
            return ''
        }

        const connection = this.connectionService.connection(clusterId)
        if (!connection) {
            session.fail(TerminalService.notConnected, 'none')
            return ''
        }
        if (!connection.canOpenChannel) {
            session.fail(connection.channelBlockReason, 'unsupported')
            return ''
        }

        return connection.sessionId
    }

    private async guard(session: TerminalSession, action: () => Promise<void>): Promise<void> {
        try {
            await action()
        } catch (err) {
            await session.stop()
            session.fail(TerminalService.describe(err), 'none')
            throw err
        }
    }

    private static channelSpec(sessionId: string, path: string): TKubeChannelSpec {
        return {
            sessionId,
            path,
            tty: true,
            cols: TerminalLimits.defaultCols,
            rows: TerminalLimits.defaultRows,
        }
    }

    private static describe(err: unknown): string {
        if (err instanceof ApiError) {
            return err.details ? `${err.message}: ${err.details}` : err.message
        }

        return err instanceof Error ? err.message : String(err)
    }
}
