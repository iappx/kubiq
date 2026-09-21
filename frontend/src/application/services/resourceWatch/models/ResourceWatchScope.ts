import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import type { TResourceScopeWatchRequest } from '@/application/services/resourceList/types/TResourceScopeWatchRequest'
import { ResourceWatchLimits } from '@/application/services/resourceWatch/constants/ResourceWatchLimits'
import type { IResourceWatchSink } from '@/application/services/resourceWatch/types/IResourceWatchSink'
import type { TResourceChangeType } from '@/application/services/resourceWatch/types/TResourceChangeType'
import { KubeObjectKey } from '@/domain/entities/kube'
import { KubeObjectReader } from '@/infrastructure/entityRepo/kube/KubeObjectReader'
import type { IKubeWatchHandler } from '@/infrastructure/entityRepo/kube/transport/types/IKubeWatchHandler'
import type { TKubeWatchEvent } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchEvent'
import type { TKubeWatchStatus } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchStatus'
import type { IClusterStream } from '@/infrastructure/kube/types/IClusterStream'

export class ResourceWatchScope implements IKubeWatchHandler {
    private stream: IClusterStream | null = null

    private resourceVersion: string

    private openedAt: number = 0

    private flaps: number = 0

    private stopped: boolean = false

    constructor(
        private readonly listService: ResourceListService,
        private readonly request: TResourceScopeWatchRequest,
        private readonly sink: IResourceWatchSink,
    ) {
        this.resourceVersion = request.resourceVersion
    }

    public get namespace(): string {
        return this.request.namespace
    }

    public async start(): Promise<void> {
        if (this.stopped) {
            return
        }

        this.openedAt = Date.now()
        this.stream = await this.listService.watch({ ...this.request, resourceVersion: this.resourceVersion }, this)
    }

    public async stop(): Promise<void> {
        this.stopped = true
        const open = this.stream
        this.stream = null
        if (open) {
            await open.stop()
        }
    }

    public onEvent(event: TKubeWatchEvent): void {
        if (this.stopped) {
            return
        }
        if (event.object) {
            this.remember(event.object)
        }

        if (event.type === 'expired') {
            this.sink.resync()
            return
        }
        if (event.type === 'error') {
            this.sink.stale()
            return
        }
        if (event.type === 'bookmark' || !event.object) {
            return
        }

        this.sink.accept({
            type: event.type as TResourceChangeType,
            key: KubeObjectKey.ofObject(event.object),
            entity: this.listService.toEntity(this.request.clusterId, this.request.kind, event.object),
        })
    }

    // 'stopped' is deliberate — ours or the stream registry draining the cluster —
    // so it neither reconnects nor reports the list as stale.
    public onClose(status: TKubeWatchStatus): void {
        this.stream = null
        if (this.stopped || status === 'stopped') {
            return
        }
        if (status === 'error' || !this.canRetry()) {
            this.sink.stale()
            return
        }

        void this.start().catch(() => this.sink.stale())
    }

    private remember(object: Record<string, unknown>): void {
        const version = KubeObjectReader.resourceVersionOf(object)
        if (version !== '') {
            this.resourceVersion = version
        }
    }

    // A watch the API server closed on its own timeout is resumed; one that dies the moment
    // it opens is flapping, and retrying that in a loop is worse than reporting stale data.
    private canRetry(): boolean {
        this.flaps = Date.now() - this.openedAt < ResourceWatchLimits.minimumLifetimeMs ? this.flaps + 1 : 0

        return this.flaps < ResourceWatchLimits.maxConsecutiveFlaps
    }
}
