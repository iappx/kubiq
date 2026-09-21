import { inject } from 'tsyringe'
import { PortForwardService } from '@/application/services/portForward/PortForwardService'
import type { IPortForwardSink } from '@/application/services/portForward/types/IPortForwardSink'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import type { TPortForwardPort } from '@/application/services/portForward/types/TPortForwardPort'
import type { TPortForwardRequest } from '@/application/services/portForward/types/TPortForwardRequest'
import type { TPortForwardTarget } from '@/application/services/portForward/types/TPortForwardTarget'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { PortForwardStartedEvent } from '@/domain/events/terminal/PortForwardStartedEvent'
import { PortForwardStoppedEvent } from '@/domain/events/terminal/PortForwardStoppedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class PortForwardStore extends StoreBase<PortForwardStore> implements IPortForwardSink {
    public forwards: TPortForward[] = []

    public ports: TPortForwardPort[] = []

    public target: TPortForwardTarget | null = null

    public starting = false

    public loadingPorts = false

    constructor(
        @inject(PortForwardService) private readonly portForwardService: PortForwardService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public forwardsOf(clusterId: string): TPortForward[] {
        return this.forwards.filter(forward => forward.clusterId === clusterId)
    }

    public async start(request: TPortForwardRequest): Promise<boolean> {
        this.starting = true
        try {
            const started = await this.portForwardService.start(request, this)
            this.forwards = [...this.forwards.filter(open => open.forwardId !== started.forwardId), { ...started }]
            this.eventBus.emitEvent(new PortForwardStartedEvent(
                started.clusterId,
                started.forwardId,
                started.label,
                started.localPort,
            ))

            return true
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.start'))
            return false
        } finally {
            this.starting = false
        }
    }

    public async stop(forwardId: string): Promise<void> {
        try {
            const stopped = await this.portForwardService.stop(forwardId)
            this.forwards = this.forwards.filter(forward => forward.forwardId !== forwardId)

            if (stopped) {
                this.eventBus.emitEvent(new PortForwardStoppedEvent(
                    stopped.clusterId,
                    stopped.forwardId,
                    stopped.label,
                    stopped.localPort,
                ))
            }
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.stop'))
        }
    }

    public async open(forwardId: string): Promise<void> {
        try {
            await this.portForwardService.open(forwardId)
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.open'))
        }
    }

    public async loadPorts(clusterId: string, namespace: string, resource: string, name: string): Promise<void> {
        this.loadingPorts = true
        try {
            this.ports = await this.portForwardService.ports(clusterId, namespace, resource, name)
        } catch (err) {
            this.ports = []
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PortForwardStore.loadPorts'))
        } finally {
            this.loadingPorts = false
        }
    }

    public clearPorts(): void {
        this.ports = []
    }

    public async setTarget(target: TPortForwardTarget | null): Promise<void> {
        this.target = target
        this.ports = []

        if (target) {
            await this.loadPorts(target.clusterId, target.namespace, target.resource, target.name)
        }
    }

    public async closeCluster(clusterId: string): Promise<void> {
        this.forwards = this.forwards.filter(forward => forward.clusterId !== clusterId)

        await this.portForwardService.closeCluster(clusterId)
    }

    public async closeAll(): Promise<void> {
        this.forwards = []

        await this.portForwardService.closeAll()
    }

    public urlOf(forward: TPortForward): string {
        return this.portForwardService.urlOf(forward)
    }

    public onForwardChanged(forward: TPortForward): void {
        this.forwards = this.forwards.map(open => (open.forwardId === forward.forwardId ? { ...forward } : open))
    }

    public onForwardClosed(forwardId: string): void {
        this.forwards = this.forwards.filter(forward => forward.forwardId !== forwardId)
    }
}
