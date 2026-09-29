import { inject, singleton } from 'tsyringe'
import { ClipboardService } from '@/application/services/clipboard/ClipboardService'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { IdService } from '@/application/services/id/IdService'
import { PortForwardLabel } from '@/application/services/portForward/models/PortForwardLabel'
import { PortForwardRecord } from '@/application/services/portForward/models/PortForwardRecord'
import { PortForwardSession } from '@/application/services/portForward/models/PortForwardSession'
import { PortForwardTarget } from '@/application/services/portForward/models/PortForwardTarget'
import type { IPortForwardSessionOwner } from '@/application/services/portForward/types/IPortForwardSessionOwner'
import type { IPortForwardSink } from '@/application/services/portForward/types/IPortForwardSink'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import type { TPortForwardBackend } from '@/application/services/portForward/types/TPortForwardBackend'
import type { TPortForwardChange } from '@/application/services/portForward/types/TPortForwardChange'
import type { TPortForwardPort } from '@/application/services/portForward/types/TPortForwardPort'
import type { TPortForwardRequest } from '@/application/services/portForward/types/TPortForwardRequest'
import type { TPortForwardRuntime } from '@/application/services/portForward/types/TPortForwardRuntime'
import type { ServiceEntity } from '@/domain/entities/network'
import { PortForwardEntity } from '@/domain/entities/portForward/PortForwardEntity'
import { PortForwardRemotePort } from '@/domain/entities/portForward/PortForwardRemotePort'
import { PortForwardRestoreModeCatalog } from '@/domain/entities/portForward/PortForwardRestoreModeCatalog'
import type { PodEntity } from '@/domain/entities/workloads'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeApiParams } from '@/infrastructure/entityRepo/kube/KubeApiParams'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { KubeForwardAdapter } from '@/infrastructure/channel/KubeForwardAdapter'
import type { TKubeForwardHandle } from '@/infrastructure/channel/types/TKubeForwardHandle'
import { PodChannelPath } from '@/infrastructure/channel/PodChannelPath'
import { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'

@singleton()
export class PortForwardService implements IPortForwardSessionOwner {
    public static readonly notConnected: string = 'That cluster is not connected'

    public static readonly noBackend: string = 'No running pod stands behind that service'

    public static readonly podGone: string = 'The pod is gone'

    public static readonly noPort: string = 'That port is not declared'

    public static readonly unknownForward: string = 'That port forward no longer exists'

    public static readonly dropped: string = 'The forward was closed by the cluster'

    public static readonly runningPods: string = 'status.phase=Running'

    public static readonly checkIntervalMs: number = 5000

    private readonly sessions = new Map<string, PortForwardSession>()

    constructor(
        @inject(EntityRepoProvider) private readonly repoProvider: EntityRepoProvider,
        @inject(IdService) private readonly idService: IdService,
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(KubeForwardAdapter) private readonly forwards: KubeForwardAdapter,
        @inject(HostShellAdapter) private readonly host: HostShellAdapter,
        @inject(ClipboardService) private readonly clipboardService: ClipboardService,
    ) {}

    public async list(): Promise<TPortForward[]> {
        const stored = await this.repoProvider.portForwards.forwards.getAll()

        return stored.map(entity => PortForwardRecord.of(entity, this.runtimeOf(entity)))
    }

    public async create(request: TPortForwardRequest, now: number): Promise<TPortForward> {
        const entity = PortForwardEntity.build({
            id: this.idService.next(),
            clusterId: request.clusterId,
            namespace: request.namespace,
            resource: request.resource,
            name: request.name,
            remotePort: PortForwardRemotePort.of(request.remotePort),
            localPort: request.localPort,
            lastLocalPort: 0,
            restoreMode: PortForwardRestoreModeCatalog.of(request.restoreMode),
            isStoppedByUser: false,
            createdAt: now,
        })

        await this.repoProvider.portForwards.forwards.create(entity)

        return PortForwardRecord.of(entity, PortForwardRecord.idle('stopped'))
    }

    public async update(id: string, change: TPortForwardChange): Promise<TPortForward> {
        const entity = await this.require(id)

        if (change.remotePort !== undefined) {
            entity.remotePort = PortForwardRemotePort.of(change.remotePort)
        }
        if (change.localPort !== undefined) {
            entity.localPort = change.localPort
        }
        if (change.restoreMode !== undefined) {
            entity.restoreMode = PortForwardRestoreModeCatalog.of(change.restoreMode)
        }

        await this.repoProvider.portForwards.forwards.update(entity)

        return PortForwardRecord.of(entity, this.runtimeOf(entity))
    }

    public async remove(id: string): Promise<void> {
        await this.stop(id)
        await this.repoProvider.portForwards.forwards.remove(id)
    }

    public async rememberPort(id: string, port: number): Promise<void> {
        const entity = await this.repoProvider.portForwards.forwards.getById(id)
        if (!entity || port <= 0 || entity.lastLocalPort === port) {
            return
        }

        entity.lastLocalPort = port
        await this.repoProvider.portForwards.forwards.update(entity)
    }

    public async rememberStopped(id: string, isStoppedByUser: boolean): Promise<void> {
        const entity = await this.repoProvider.portForwards.forwards.getById(id)
        if (!entity) {
            return
        }

        entity.isStoppedByUser = isStoppedByUser
        await this.repoProvider.portForwards.forwards.update(entity)
    }

    public isConnected(clusterId: string): boolean {
        return this.connectionService.isConnected(clusterId)
    }

    public isRunning(id: string): boolean {
        const session = this.sessions.get(id)

        return session !== undefined && !session.isStopped
    }

    public async start(forward: TPortForward, sink: IPortForwardSink): Promise<TPortForwardRuntime> {
        await this.stop(forward.id)

        const connection = this.connectionService.connection(forward.clusterId)
        if (!connection) {
            throw new ApiError(
                PortForwardService.notConnected,
                `No open session for "${forward.clusterId}" — connect to it from the cluster catalog first`,
            )
        }

        this.connectionService.assertChannelAllowed(forward.clusterId)

        const backend = await this.resolve(forward)
        const session = new PortForwardSession({ ...forward }, this.forwards, sink, this)
        const handle = await this.listen(connection.sessionId, forward, backend, session)

        if (session.isStopped) {
            throw new ApiError(PortForwardService.dropped, session.lastError)
        }

        session.attach(handle.forwardId, handle.localPort, backend)

        const previous = this.sessions.get(forward.id)
        this.sessions.set(forward.id, session)
        await previous?.stop()

        session.hold(this.connectionService.registerStream(forward.clusterId, session))
        session.watch(PortForwardService.checkIntervalMs, () => void this.recheck(forward.id))

        return { ...session.runtime }
    }

    public async stop(id: string): Promise<boolean> {
        const session = this.sessions.get(id)
        if (!session) {
            return false
        }

        this.sessions.delete(id)
        await session.stop()

        return true
    }

    public async stopCluster(clusterId: string): Promise<string[]> {
        const ids = [...this.sessions.values()]
            .filter(session => session.clusterId === clusterId)
            .map(session => session.id)

        await Promise.allSettled(ids.map(id => this.stop(id)))

        return ids
    }

    public async stopAll(): Promise<void> {
        const ids = [...this.sessions.keys()]
        await Promise.allSettled(ids.map(id => this.stop(id)))
    }

    public async recheck(id: string): Promise<void> {
        const session = this.sessions.get(id)
        if (!session || !session.claimCheck()) {
            return
        }

        try {
            await this.verify(session)
        } catch {
            // A probe that cannot reach the cluster says nothing about the pod; the next tick asks again.
        } finally {
            session.releaseCheck()
        }
    }

    public onSessionError(session: PortForwardSession): void {
        void this.recheck(session.id)
    }

    public onSessionClosed(session: PortForwardSession): void {
        if (this.sessions.get(session.id) === session) {
            this.sessions.delete(session.id)
        }

        session.report(PortForwardRecord.idle('error', session.lastError || PortForwardService.dropped))
    }

    public async open(forward: TPortForward): Promise<void> {
        const url = PortForwardRecord.urlOf(forward)
        if (url === '') {
            return
        }

        await this.host.openUri(url)
    }

    public async copyAddress(forward: TPortForward): Promise<string> {
        const address = PortForwardRecord.addressOf(forward)
        if (address === '') {
            return ''
        }

        await this.clipboardService.write(address)

        return address
    }

    public async names(clusterId: string, namespace: string, resource: string): Promise<string[]> {
        if (namespace === '') {
            return []
        }

        const found = resource === PortForwardLabel.services
            ? await this.servicesIn(clusterId, namespace)
            : await this.podsIn(clusterId, namespace)

        return found
            .map(entity => entity.name)
            .filter(name => name !== '')
            .sort((left, right) => left.localeCompare(right))
    }

    public async ports(clusterId: string, namespace: string, resource: string, name: string): Promise<TPortForwardPort[]> {
        if (resource === PortForwardLabel.services) {
            const service = await this.service(clusterId, namespace, name)

            return service ? PortForwardTarget.servicePorts(service) : []
        }

        const pod = await this.pod(clusterId, namespace, name)

        return pod ? PortForwardTarget.podPorts(pod) : []
    }

    private runtimeOf(entity: PortForwardEntity): TPortForwardRuntime {
        const session = this.sessions.get(entity.id)
        if (session && !session.isStopped) {
            return { ...session.runtime }
        }

        return PortForwardRecord.idle(PortForwardRecord.restingStatus(
            PortForwardRestoreModeCatalog.of(entity.restoreMode),
            entity.isStoppedByUser === true,
        ))
    }

    private async require(id: string): Promise<PortForwardEntity> {
        const entity = await this.repoProvider.portForwards.forwards.getById(id)
        if (!entity) {
            throw new ApiError(PortForwardService.unknownForward, `No saved port forward has the id "${id}"`)
        }

        return entity
    }

    private async listen(
        sessionId: string,
        forward: TPortForward,
        backend: TPortForwardBackend,
        session: PortForwardSession,
    ): Promise<TKubeForwardHandle> {
        const open = (localPort: number): Promise<TKubeForwardHandle> => this.forwards.start({
            sessionId,
            path: PodChannelPath.portForward(forward.namespace, backend.podName, backend.targetPort),
            remotePort: backend.targetPort,
            localPort,
            localAddress: PortForwardRecord.loopback,
        }, session)

        if (forward.localPort > 0 || forward.lastLocalPort <= 0) {
            return open(forward.localPort)
        }

        try {
            return await open(forward.lastLocalPort)
        } catch {
            return open(0)
        }
    }

    private async verify(session: PortForwardSession): Promise<void> {
        const forward = session.forward
        const pod = await this.currentPod(forward.clusterId, forward.namespace, session.runtime.podName)
        if (session.isStopped) {
            return
        }

        if (pod && PortForwardTarget.isServing(pod)) {
            if (session.runtime.status !== 'active') {
                session.update({ status: 'active', error: '' })
            }
            return
        }

        if (forward.resource === PortForwardLabel.pods) {
            await this.abandon(session, `Pod ${forward.namespace}/${forward.name} was deleted`)
            return
        }

        await this.move(session)
    }

    private async move(session: PortForwardSession): Promise<void> {
        let backend: TPortForwardBackend
        try {
            backend = await this.resolve(session.forward)
        } catch (err) {
            session.update({ status: 'reconnecting', error: err instanceof ApiError ? err.message : String(err) })
            return
        }

        if (session.isStopped) {
            return
        }

        await this.forwards.retarget(session.forwardId, {
            path: PodChannelPath.portForward(session.forward.namespace, backend.podName, backend.targetPort),
            remotePort: backend.targetPort,
        })
        session.update({ status: 'active', error: '', podName: backend.podName, targetPort: backend.targetPort })
    }

    private async abandon(session: PortForwardSession, reason: string): Promise<void> {
        if (this.sessions.get(session.id) === session) {
            this.sessions.delete(session.id)
        }

        await session.stop()
        session.report(PortForwardRecord.idle('error', reason))
    }

    private resolve(forward: TPortForward): Promise<TPortForwardBackend> {
        return forward.resource === PortForwardLabel.services
            ? this.resolveService(forward)
            : this.resolvePod(forward)
    }

    private async resolvePod(forward: TPortForward): Promise<TPortForwardBackend> {
        const pod = await this.currentPod(forward.clusterId, forward.namespace, forward.name)
        if (!pod || pod.metadata?.isDeleting) {
            throw new ApiError(PortForwardService.podGone, `Pod ${forward.namespace}/${forward.name} was not found`)
        }

        const targetPort = PortForwardTarget.containerPort(pod, forward.remotePort)
        if (targetPort === 0) {
            throw new ApiError(
                PortForwardService.noPort,
                `Pod ${forward.namespace}/${forward.name} declares no port "${forward.remotePort}"`,
            )
        }

        return { podName: forward.name, targetPort }
    }

    private async resolveService(forward: TPortForward): Promise<TPortForwardBackend> {
        const service = await this.service(forward.clusterId, forward.namespace, forward.name)
        if (!service) {
            throw new ApiError(PortForwardService.noBackend, `Service ${forward.namespace}/${forward.name} was not found`)
        }

        const port = PortForwardTarget.servicePort(service, forward.remotePort)
        if (!port) {
            throw new ApiError(
                PortForwardService.noPort,
                `Service ${forward.namespace}/${forward.name} declares no port "${forward.remotePort}"`,
            )
        }

        const selector = PortForwardTarget.selectorOf(service)
        const backend = selector === '' ? undefined : await this.backend(forward.clusterId, forward.namespace, selector)
        if (!backend) {
            throw new ApiError(
                PortForwardService.noBackend,
                `Service ${forward.namespace}/${forward.name} selects no running pod`,
            )
        }

        return { podName: backend.name, targetPort: PortForwardTarget.targetPortOf(backend, port) }
    }

    private async backend(clusterId: string, namespace: string, selector: string): Promise<PodEntity | undefined> {
        const running = await this.connectionService.context(clusterId).pods
            .withPathParams({ [KubeUrlBuilder.namespaceParam]: namespace })
            .rawFilter({
                [KubeApiParams.labelSelector]: selector,
                [KubeApiParams.fieldSelector]: PortForwardService.runningPods,
            })
            .getAll()

        return running.find(pod => PortForwardTarget.isServing(pod))
    }

    private async currentPod(clusterId: string, namespace: string, name: string): Promise<PodEntity | null> {
        try {
            return (await this.pod(clusterId, namespace, name)) ?? null
        } catch (err) {
            if (KubeStatusReader.isMissing(err)) {
                return null
            }
            throw err
        }
    }

    private podsIn(clusterId: string, namespace: string): Promise<PodEntity[]> {
        return this.connectionService.context(clusterId).pods
            .withPathParams({ [KubeUrlBuilder.namespaceParam]: namespace })
            .rawFilter({ [KubeApiParams.fieldSelector]: PortForwardService.runningPods })
            .getAll()
    }

    private servicesIn(clusterId: string, namespace: string): Promise<ServiceEntity[]> {
        return this.connectionService.context(clusterId).services
            .withPathParams({ [KubeUrlBuilder.namespaceParam]: namespace })
            .getAll()
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
