import { inject } from 'tsyringe'
import { ClusterEntryService } from '@/application/services/clusterEntry/ClusterEntryService'
import { PortForwardService } from '@/application/services/portForward/PortForwardService'
import { PortForwardRecord } from '@/application/services/portForward/models/PortForwardRecord'
import type { IPortForwardSink } from '@/application/services/portForward/types/IPortForwardSink'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import type { TPortForwardChange } from '@/application/services/portForward/types/TPortForwardChange'
import type { TPortForwardPort } from '@/application/services/portForward/types/TPortForwardPort'
import type { TPortForwardRequest } from '@/application/services/portForward/types/TPortForwardRequest'
import type { TPortForwardRuntime } from '@/application/services/portForward/types/TPortForwardRuntime'
import { PortForwardRestoreModeCatalog } from '@/domain/entities/portForward/PortForwardRestoreModeCatalog'
import { PortForwardStatusCatalog } from '@/domain/entities/portForward/PortForwardStatusCatalog'
import type { TPortForwardRemotePort } from '@/domain/entities/portForward/types/TPortForwardRemotePort'
import { ApiError } from '@/domain/errors/ApiError'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { SuccessMessageEvent } from '@/domain/events/app/SuccessMessageEvent'
import { PortForwardStartedEvent } from '@/domain/events/terminal/PortForwardStartedEvent'
import { PortForwardStoppedEvent } from '@/domain/events/terminal/PortForwardStoppedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class PortForwardStore extends StoreBase<PortForwardStore> implements IPortForwardSink {
    public static readonly unreachable: string = 'The cluster could not be connected'

    public forwards: TPortForward[] = []

    public loaded = false

    public loading = false

    public ports: TPortForwardPort[] = []

    public names: string[] = []

    public starting = false

    public loadingPorts = false

    private portsRequest = 0

    private namesRequest = 0

    constructor(
        @inject(PortForwardService) private readonly portForwardService: PortForwardService,
        @inject(ClusterEntryService) private readonly entryService: ClusterEntryService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public get activeCount(): number {
        return this.forwards.filter(forward => PortForwardStatusCatalog.isListening(forward.status)).length
    }

    public get hasProblems(): boolean {
        return this.forwards.some(forward => PortForwardStatusCatalog.isProblematic(forward.status))
    }

    public get clusterIds(): string[] {
        return [...new Set(this.forwards.map(forward => forward.clusterId))]
    }

    public forwardsOf(clusterId: string): TPortForward[] {
        return this.forwards.filter(forward => forward.clusterId === clusterId)
    }

    public find(id: string): TPortForward | undefined {
        return this.forwards.find(forward => forward.id === id)
    }

    public findFor(
        clusterId: string,
        namespace: string,
        resource: string,
        name: string,
        remotePort: TPortForwardRemotePort,
    ): TPortForward | undefined {
        return this.forwards.find(forward => PortForwardRecord.matches(forward, clusterId, namespace, resource, name, remotePort))
    }

    public findForPort(
        clusterId: string,
        namespace: string,
        resource: string,
        name: string,
        port: TPortForwardPort,
    ): TPortForward | undefined {
        return this.findFor(clusterId, namespace, resource, name, port.port)
            ?? (port.name === '' ? undefined : this.findFor(clusterId, namespace, resource, name, port.name))
    }

    public throughPod(clusterId: string, namespace: string, podName: string): TPortForward[] {
        return this.forwards.filter(forward => forward.resource === 'services'
            && forward.clusterId === clusterId
            && forward.namespace === namespace
            && forward.podName === podName
            && PortForwardStatusCatalog.isListening(forward.status))
    }

    public addressOf(forward: TPortForward): string {
        return PortForwardRecord.addressOf(forward)
    }

    public urlOf(forward: TPortForward): string {
        return PortForwardRecord.urlOf(forward)
    }

    public async load(): Promise<void> {
        if (this.loaded || this.loading) {
            return
        }

        this.loading = true
        try {
            this.forwards = await this.portForwardService.list()
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.load'))
        } finally {
            this.loading = false
            this.loaded = true
        }

        await this.startWaiting(forward => this.portForwardService.isConnected(forward.clusterId))
    }

    public async restore(): Promise<void> {
        await this.load()

        const clusters = [...new Set(this.forwards
            .filter(forward => PortForwardRestoreModeCatalog.connectsOnStart(forward.restoreMode) && !forward.isStoppedByUser)
            .filter(forward => !this.portForwardService.isConnected(forward.clusterId))
            .map(forward => forward.clusterId))]

        await Promise.all(clusters.map(clusterId => this.connect(clusterId)))
    }

    public async create(request: TPortForwardRequest): Promise<TPortForward | null> {
        await this.load()

        const existing = this.findFor(request.clusterId, request.namespace, request.resource, request.name, request.remotePort)
        if (existing) {
            await this.update(existing.id, { localPort: request.localPort, restoreMode: request.restoreMode })
            if (!PortForwardStatusCatalog.isRunning(this.find(existing.id)?.status ?? 'stopped')) {
                await this.start(existing.id)
            }

            return this.find(existing.id) ?? null
        }

        this.starting = true
        try {
            const created = await this.portForwardService.create(request, Date.now())
            this.forwards = [...this.forwards, created]
            await this.start(created.id)

            return this.find(created.id) ?? null
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.create'))
            return null
        } finally {
            this.starting = false
        }
    }

    public async update(id: string, change: TPortForwardChange): Promise<boolean> {
        const current = this.find(id)
        if (!current) {
            return false
        }

        try {
            const updated = await this.portForwardService.update(id, change)
            const latest = this.find(id) ?? current
            const restart = PortForwardRecord.changesPorts(current, change)
                && PortForwardStatusCatalog.isRunning(latest.status)
            const parked = latest.status === 'waiting'
                && !PortForwardRestoreModeCatalog.restoresOnConnect(updated.restoreMode)

            this.replace(id, {
                ...updated,
                isStoppedByUser: latest.isStoppedByUser,
                ...PortForwardRecord.runtimeOf(latest),
                ...(parked ? PortForwardRecord.idle('stopped') : {}),
            })

            if (restart) {
                await this.launch(id, true)
            }

            return true
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.update'))
            return false
        }
    }

    public async start(id: string): Promise<void> {
        const forward = this.find(id)
        if (!forward || PortForwardStatusCatalog.isRunning(forward.status)) {
            return
        }

        const remembering = this.rememberStopped(id, false)

        if (this.portForwardService.isConnected(forward.clusterId)) {
            await this.launch(id, true)
        } else {
            this.patch(id, PortForwardRecord.idle('waiting'))
            await this.connect(forward.clusterId)

            if (this.find(id)?.status === 'waiting' && !this.portForwardService.isConnected(forward.clusterId)) {
                this.patch(id, PortForwardRecord.idle('error', PortForwardStore.unreachable))
            }
        }

        await remembering
    }

    public async stop(id: string): Promise<void> {
        const forward = this.find(id)
        if (!forward) {
            return
        }

        this.patch(id, PortForwardRecord.idle('stopped'))
        const remembering = this.rememberStopped(id, true)
        try {
            const wasRunning = await this.portForwardService.stop(id)
            if (wasRunning) {
                this.eventBus.emitEvent(new PortForwardStoppedEvent(forward.clusterId, id, forward.label, forward.boundPort))
            }
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.stop'))
        }

        await remembering
    }

    public async remove(id: string): Promise<void> {
        const forward = this.find(id)
        if (!forward) {
            return
        }

        this.patch(id, PortForwardRecord.idle('stopped'))
        try {
            await this.portForwardService.remove(id)
            this.forwards = this.forwards.filter(open => open.id !== id)
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.remove'))
        }
    }

    public async open(id: string): Promise<void> {
        const forward = this.find(id)
        if (!forward) {
            return
        }

        try {
            await this.portForwardService.open(forward)
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.open'))
        }
    }

    public async copyAddress(id: string): Promise<boolean> {
        const forward = this.find(id)
        if (!forward) {
            return false
        }

        try {
            const address = await this.portForwardService.copyAddress(forward)
            if (address === '') {
                return false
            }

            this.eventBus.emitEvent(new SuccessMessageEvent(`Copied ${address} to the clipboard`))

            return true
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.copyAddress'))

            return false
        }
    }

    public async onClusterConnected(clusterId: string): Promise<void> {
        await this.load()
        await this.startWaiting(forward => forward.clusterId === clusterId)
    }

    public async onClusterDisconnected(clusterId: string): Promise<void> {
        this.forwards = this.forwards.map(forward => (forward.clusterId !== clusterId || forward.status === 'stopped'
            ? forward
            : { ...forward, ...PortForwardRecord.idle(PortForwardRecord.restingStatus(forward.restoreMode, forward.isStoppedByUser)) }))

        try {
            await this.portForwardService.stopCluster(clusterId)
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.onClusterDisconnected'))
        }
    }

    public async stopAll(): Promise<void> {
        await this.portForwardService.stopAll()
    }

    public onForwardChanged(id: string, runtime: TPortForwardRuntime): void {
        const forward = this.find(id)
        if (!forward || forward.status === 'stopped' || forward.status === 'waiting') {
            return
        }

        this.patch(id, runtime)
    }

    public remotePortsOn(
        clusterId: string,
        namespace: string,
        resource: string,
        name: string,
        exceptId: string = '',
    ): TPortForwardRemotePort[] {
        return this.forwards
            .filter(forward => forward.id !== exceptId
                && forward.clusterId === clusterId
                && forward.namespace === namespace
                && forward.resource === resource
                && forward.name === name)
            .map(forward => forward.remotePort)
    }

    public async loadPorts(clusterId: string, namespace: string, resource: string, name: string): Promise<void> {
        const request = ++this.portsRequest
        this.ports = []

        if (!this.portForwardService.isConnected(clusterId) || namespace === '' || name === '') {
            this.loadingPorts = false
            return
        }

        this.loadingPorts = true
        try {
            const ports = await this.portForwardService.ports(clusterId, namespace, resource, name)
            if (request === this.portsRequest) {
                this.ports = ports
            }
        } catch (err) {
            if (request === this.portsRequest) {
                this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.loadPorts'))
            }
        } finally {
            if (request === this.portsRequest) {
                this.loadingPorts = false
            }
        }
    }

    public clearPorts(): void {
        this.portsRequest += 1
        this.ports = []
        this.loadingPorts = false
    }

    public async loadNames(clusterId: string, namespace: string, resource: string): Promise<void> {
        const request = ++this.namesRequest
        this.names = []

        if (!this.portForwardService.isConnected(clusterId)) {
            return
        }

        try {
            const names = await this.portForwardService.names(clusterId, namespace, resource)
            if (request === this.namesRequest) {
                this.names = names
            }
        } catch (err) {
            if (request === this.namesRequest) {
                this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.loadNames'))
            }
        }
    }

    private async startWaiting(due: (forward: TPortForward) => boolean): Promise<void> {
        const waiting = this.forwards.filter(forward => forward.status === 'waiting' && due(forward))

        await Promise.all(waiting.map(forward => this.launch(forward.id, false)))
    }

    private async launch(id: string, announce: boolean): Promise<boolean> {
        const forward = this.find(id)
        if (!forward) {
            return false
        }

        this.patch(id, PortForwardRecord.idle('starting'))
        try {
            const runtime = await this.portForwardService.start(forward, this)

            // Stopped, removed or disconnected while it was opening: the listener it got is nobody's.
            if (this.find(id)?.status !== 'starting') {
                await this.portForwardService.stop(id)
                return false
            }

            this.patch(id, runtime)
            await this.remember(id, runtime.boundPort)

            if (announce) {
                this.eventBus.emitEvent(new PortForwardStartedEvent(forward.clusterId, id, forward.label, runtime.boundPort))
            }

            return true
        } catch (err) {
            if (this.find(id)?.status === 'starting') {
                this.patch(id, PortForwardRecord.idle('error', PortForwardStore.messageOf(err)))
            }
            if (announce) {
                this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.start'))
            }

            return false
        }
    }

    private async remember(id: string, port: number): Promise<void> {
        const forward = this.find(id)
        if (!forward || port <= 0 || forward.lastLocalPort === port) {
            return
        }

        try {
            await this.portForwardService.rememberPort(id, port)
            this.replace(id, { ...(this.find(id) ?? forward), lastLocalPort: port })
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.remember'))
        }
    }

    private async rememberStopped(id: string, isStoppedByUser: boolean): Promise<void> {
        const forward = this.find(id)
        if (!forward || forward.isStoppedByUser === isStoppedByUser) {
            return
        }

        // Flipped before the write, so a stop pressed while a start is still saving is not undone by it.
        this.replace(id, { ...forward, isStoppedByUser })
        try {
            await this.portForwardService.rememberStopped(id, isStoppedByUser)
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.rememberStopped'))
        }
    }

    private async connect(clusterId: string): Promise<void> {
        try {
            await this.entryService.connectInBackground(clusterId)
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.connect'))
        }
    }

    private patch(id: string, runtime: TPortForwardRuntime): void {
        this.forwards = this.forwards.map(forward => (forward.id === id ? { ...forward, ...runtime } : forward))
    }

    private replace(id: string, next: TPortForward): void {
        this.forwards = this.forwards.map(forward => (forward.id === id ? next : forward))
    }

    private static messageOf(err: unknown): string {
        if (err instanceof ApiError) {
            return err.details ? `${err.message}: ${err.details}` : err.message
        }

        return err instanceof Error ? err.message : String(err)
    }
}
