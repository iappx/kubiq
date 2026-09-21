import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import { ResourceWatchLimits } from '@/application/services/resourceWatch/constants/ResourceWatchLimits'
import { ResourceWatchScope } from '@/application/services/resourceWatch/models/ResourceWatchScope'
import type { IResourceWatchSink } from '@/application/services/resourceWatch/types/IResourceWatchSink'
import type { TResourceChange } from '@/application/services/resourceWatch/types/TResourceChange'
import type { TResourceWatchHandlers } from '@/application/services/resourceWatch/types/TResourceWatchHandlers'
import type { TResourceWatchRequest } from '@/application/services/resourceWatch/types/TResourceWatchRequest'

export class ResourceWatchSession implements IResourceWatchSink {
    private readonly scopes: ResourceWatchScope[] = []

    private readonly pending: TResourceChange[] = []

    private timer: ReturnType<typeof setTimeout> | null = null

    private stopped: boolean = false

    private resyncing: boolean = false

    private staleAt: number = 0

    constructor(
        private readonly listService: ResourceListService,
        private readonly request: TResourceWatchRequest,
        private readonly handlers: TResourceWatchHandlers,
        private readonly flushIntervalMs: number = ResourceWatchLimits.flushIntervalMs,
    ) {}

    public get isStale(): boolean {
        return this.staleAt > 0
    }

    public async start(): Promise<void> {
        this.request.cursors.forEach((cursor) => {
            this.scopes.push(new ResourceWatchScope(this.listService, {
                clusterId: this.request.clusterId,
                kind: this.request.kind,
                namespace: cursor.namespace,
                resourceVersion: cursor.resourceVersion,
                labelSelector: this.request.labelSelector,
                fieldSelector: this.request.fieldSelector,
            }, this))
        })

        const outcomes = await Promise.allSettled(this.scopes.map(scope => scope.start()))
        const failure = outcomes.find(outcome => outcome.status === 'rejected')

        if (failure) {
            await this.stop()
            throw (failure as PromiseRejectedResult).reason
        }
    }

    public async stop(): Promise<void> {
        this.stopped = true
        this.cancelFlush()
        this.pending.length = 0

        const open = this.scopes.splice(0, this.scopes.length)
        await Promise.allSettled(open.map(scope => scope.stop()))
    }

    public accept(change: TResourceChange): void {
        if (this.stopped) {
            return
        }

        this.pending.push(change)

        if (this.pending.length > ResourceWatchLimits.maxPendingChanges) {
            this.pending.length = 0
            this.resync()
            return
        }

        this.scheduleFlush()
    }

    public resync(): void {
        if (this.stopped || this.resyncing) {
            return
        }

        this.resyncing = true
        this.handlers.onResync()
    }

    public stale(): void {
        if (this.stopped || this.staleAt > 0) {
            return
        }

        this.staleAt = Date.now()
        this.handlers.onStale(this.staleAt)
    }

    public flush(): void {
        this.cancelFlush()
        if (this.pending.length === 0) {
            return
        }

        this.handlers.onChanges(this.pending.splice(0, this.pending.length))
    }

    private scheduleFlush(): void {
        if (this.timer !== null) {
            return
        }

        this.timer = setTimeout(() => this.flush(), this.flushIntervalMs)
    }

    private cancelFlush(): void {
        if (this.timer !== null) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }
}
