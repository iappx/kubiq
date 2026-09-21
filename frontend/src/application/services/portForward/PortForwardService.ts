import { inject, singleton } from 'tsyringe'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { PortForwardLabel } from '@/application/services/portForward/models/PortForwardLabel'
import { PortForwardSession } from '@/application/services/portForward/models/PortForwardSession'
import { PortForwardTarget } from '@/application/services/portForward/models/PortForwardTarget'
import type { IPortForwardSink } from '@/application/services/portForward/types/IPortForwardSink'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import type { TPortForwardPort } from '@/application/services/portForward/types/TPortForwardPort'
import type { TPortForwardRequest } from '@/application/services/portForward/types/TPortForwardRequest'
import type { ServiceEntity } from '@/domain/entities/network'
import type { PodEntity } from '@/domain/entities/workloads'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeApiParams } from '@/infrastructure/entityRepo/kube/KubeApiParams'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'
import { KubeForwardAdapter } from '@/infrastructure/channel/KubeForwardAdapter'
import { PodChannelPath } from '@/infrastructure/channel/PodChannelPath'
import { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'

@singleton()
export class PortForwardService {
    public static readonly notConnected: string = 'That cluster is not connected'

    public static readonly noBackend: string = 'No running pod stands behind that service'

    public static readonly runningPods: string = 'status.phase=Running'

    private readonly sessions = new Map<string, PortForwardSession>()

    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(KubeForwardAdapter) private readonly forwards: KubeForwardAdapter,
        @inject(HostShellAdapter) private readonly host: HostShellAdapter,
    ) {}

    public async start(request: TPortForwardRequest, sink: IPortForwardSink): Promise<TPortForward> {
        const connection = this.connectionService.connection(request.clusterId)
        if (!connection) {
            throw new ApiError(
                PortForwardService.notConnected,
                `No open session for "${request.clusterId}" — connect to it from the cluster catalog first`,
            )
        }

        this.connectionService.assertChannelAllowed(request.clusterId)

        const target = await this.resolve(request)
        const handle = await this.forwardsOf(connection.sessionId, target, request.localPort, sink)

        return handle
    }

    public async stop(forwardId: string): Promise<TPortForward | null> {
        const session = this.sessions.get(forwardId)
        if (!session) {
            return null
        }

        this.sessions.delete(forwardId)
        await session.stop()

        return session.forward
    }

    public async closeCluster(clusterId: string): Promise<TPortForward[]> {
        const stopping = [...this.sessions.values()].filter(session => session.clusterId === clusterId)
        await Promise.allSettled(stopping.map(session => this.stop(session.id)))

        return stopping.map(session => session.forward)
    }

    public async closeAll(): Promise<void> {
        const ids = [...this.sessions.keys()]
        await Promise.allSettled(ids.map(forwardId => this.stop(forwardId)))
    }

    public list(clusterId: string = ''): TPortForward[] {
        return [...this.sessions.values()]
            .map(session => session.forward)
            .filter(forward => clusterId === '' || forward.clusterId === clusterId)
    }

    public urlOf(forward: TPortForward): string {
        return `http://${forward.address}:${forward.localPort}`
    }

    public async open(forwardId: string): Promise<void> {
        const session = this.sessions.get(forwardId)
        if (!session) {
            return
        }

        await this.host.openUri(this.urlOf(session.forward))
    }

    public async ports(clusterId: string, namespace: string, resource: string, name: string): Promise<TPortForwardPort[]> {
        if (resource === PortForwardLabel.services) {
            const service = await this.service(clusterId, namespace, name)

            return service ? PortForwardTarget.servicePorts(service) : []
        }

        const pod = await this.pod(clusterId, namespace, name)

        return pod ? PortForwardTarget.podPorts(pod) : []
    }

    private async forwardsOf(
        sessionId: string,
        forward: TPortForward,
        localPort: number,
        sink: IPortForwardSink,
    ): Promise<TPortForward> {
        const session = new PortForwardSession(
            forward,
            this.forwards,
            changed => sink.onForwardChanged(changed),
            forwardId => this.forget(forwardId, sink),
        )

        const handle = await this.forwards.start({
            sessionId,
            path: PodChannelPath.portForward(forward.namespace, forward.podName, forward.targetPort),
            remotePort: forward.targetPort,
            localPort,
            localAddress: forward.address,
        }, session)

        forward.forwardId = handle.forwardId
        forward.localPort = handle.localPort

        this.sessions.set(handle.forwardId, session)
        session.hold(this.connectionService.registerStream(forward.clusterId, session))

        return forward
    }

    private forget(forwardId: string, sink: IPortForwardSink): void {
        this.sessions.delete(forwardId)
        sink.onForwardClosed(forwardId)
    }

    private async resolve(request: TPortForwardRequest): Promise<TPortForward> {
        const blank: TPortForward = {
            forwardId: '',
            clusterId: request.clusterId,
            namespace: request.namespace,
            resource: request.resource,
            name: request.name,
            label: PortForwardLabel.of(request.resource, request.name, request.remotePort),
            podName: request.name,
            remotePort: request.remotePort,
            targetPort: request.remotePort,
            localPort: request.localPort,
            address: KubeForwardAdapter.loopback,
            state: 'active',
            failure: '',
        }

        if (request.resource !== PortForwardLabel.services) {
            return blank
        }

        const service = await this.service(request.clusterId, request.namespace, request.name)
        if (!service) {
            throw new ApiError(PortForwardService.noBackend, `Service ${request.namespace}/${request.name} was not found`)
        }

        const selector = PortForwardTarget.selectorOf(service)
        const backend = selector === '' ? undefined : await this.backend(request.clusterId, request.namespace, selector)
        if (!backend) {
            throw new ApiError(
                PortForwardService.noBackend,
                `Service ${request.namespace}/${request.name} selects no running pod`,
            )
        }

        const port = PortForwardTarget.servicePort(service, request.remotePort)

        return {
            ...blank,
            podName: backend.name,
            targetPort: PortForwardTarget.containerPort(backend, port?.targetPort, request.remotePort),
        }
    }

    private async backend(clusterId: string, namespace: string, selector: string): Promise<PodEntity | undefined> {
        const running = await this.connectionService.context(clusterId).pods
            .withPathParams({ [KubeUrlBuilder.namespaceParam]: namespace })
            .rawFilter({
                [KubeApiParams.labelSelector]: selector,
                [KubeApiParams.fieldSelector]: PortForwardService.runningPods,
            })
            .getAll()

        return running[0]
    }

    private service(clusterId: string, namespace: string, name: string): Promise<ServiceEntity | undefined> {
        return this.connectionService.context(clusterId).services
            .withPathParams({
                [KubeUrlBuilder.namespaceParam]: namespace,
                [KubeUrlBuilder.nameParam]: name,
            })
            .getOne(name)
    }

    private pod(clusterId: string, namespace: string, name: string): Promise<PodEntity | undefined> {
        return this.connectionService.context(clusterId).pods
            .withPathParams({
                [KubeUrlBuilder.namespaceParam]: namespace,
                [KubeUrlBuilder.nameParam]: name,
            })
            .getOne(name)
    }
}
