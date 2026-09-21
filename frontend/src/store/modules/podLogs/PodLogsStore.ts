import { inject } from 'tsyringe'
import { PodLogsService } from '@/application/services/podLogs/PodLogsService'
import type { IPodLogSink } from '@/application/services/podLogs/types/IPodLogSink'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { SuccessMessageEvent } from '@/domain/events/app/SuccessMessageEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { PodLogKey, PodLogOptions } from '@/domain/models/kube'
import type { TPodLogOptions, TPodLogState } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'
import type { TPodLogView } from '@/store/modules/podLogs/types/TPodLogView'

@InjectableStore
export class PodLogsStore extends StoreBase<PodLogsStore> implements IPodLogSink {
    public static readonly unopenable: string = 'Could not open the log stream'

    public views: Record<string, TPodLogView> = {}

    constructor(
        @inject(PodLogsService) private readonly podLogsService: PodLogsService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public viewOf(key: string): TPodLogView | undefined {
        return this.views[key]
    }

    public has(key: string): boolean {
        return key in this.views
    }

    public async openPod(clusterId: string, namespace: string, podName: string, container: string, previous: boolean): Promise<string> {
        const key = PodLogKey.of(clusterId, namespace, podName, container)
        const known = this.views[key]

        this.views = {
            ...this.views,
            [key]: {
                ...(known ?? PodLogsStore.blank(key, clusterId, namespace, podName)),
                options: PodLogOptions.defaults(container, previous),
                state: 'connecting',
                failure: '',
                revision: 0,
                lineCount: 0,
                dropped: 0,
            },
        }

        await Promise.all([this.start(key), this.loadContainers(key)])

        return key
    }

    public applyOptions(key: string, options: TPodLogOptions): Promise<void> {
        const view = this.views[key]
        if (!view || PodLogOptions.sameSource(view.options, options)) {
            return Promise.resolve()
        }

        view.options = options

        return this.restart(key)
    }

    public reconnect(key: string): Promise<void> {
        const view = this.views[key]
        if (!view) {
            return Promise.resolve()
        }

        return this.applyOptions(key, PodLogOptions.defaults(view.options.container, false))
    }

    public showPrevious(key: string): Promise<void> {
        const view = this.views[key]
        if (!view) {
            return Promise.resolve()
        }

        return this.applyOptions(key, PodLogOptions.forPrevious(view.options, true))
    }

    public async close(key: string): Promise<void> {
        if (!(key in this.views)) {
            return
        }

        const remaining = { ...this.views }
        delete remaining[key]
        this.views = remaining

        await this.podLogsService.close(key)
    }

    public async closeCluster(clusterId: string): Promise<void> {
        const remaining: Record<string, TPodLogView> = {}
        Object.values(this.views).forEach((view) => {
            if (view.clusterId !== clusterId) {
                remaining[view.key] = view
            }
        })
        this.views = remaining

        await this.podLogsService.closeCluster(clusterId)
    }

    public setSearch(key: string, search: string): void {
        this.mutate(key, (view) => {
            view.search = search
        })
    }

    public setOnlyMatches(key: string, onlyMatches: boolean): void {
        this.mutate(key, (view) => {
            view.onlyMatches = onlyMatches
        })
    }

    public setShowContainer(key: string, showContainer: boolean): void {
        this.mutate(key, (view) => {
            view.showContainer = showContainer
        })
    }

    public setWrap(key: string, wrap: boolean): void {
        this.mutate(key, (view) => {
            view.wrap = wrap
        })
    }

    public setAutoscroll(key: string, autoscroll: boolean): void {
        this.mutate(key, (view) => {
            view.autoscroll = autoscroll
        })
    }

    public lines(key: string): readonly string[] {
        return this.podLogsService.lines(key)
    }

    public async save(key: string): Promise<string> {
        const view = this.views[key]
        if (!view) {
            return ''
        }

        try {
            const path = await this.podLogsService.save(key)
            if (path !== '') {
                this.eventBus.emitEvent(new SuccessMessageEvent(
                    `Saved ${view.lineCount.toLocaleString('en')} lines to ${path}`,
                ))
            }

            return path
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PodLogsStore.save'))
            return ''
        }
    }

    public async copy(key: string): Promise<boolean> {
        const view = this.views[key]
        if (!view) {
            return false
        }

        try {
            await this.podLogsService.copy(key)
            this.eventBus.emitEvent(new SuccessMessageEvent(
                `Copied ${view.lineCount.toLocaleString('en')} lines to the clipboard`,
            ))

            return true
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PodLogsStore.copy'))
            return false
        }
    }

    public onLines(key: string, lineCount: number, dropped: number): void {
        this.mutate(key, (view) => {
            view.revision += 1
            view.lineCount = lineCount
            view.dropped = dropped
        })
    }

    public onState(key: string, state: TPodLogState, failure: string): void {
        this.mutate(key, (view) => {
            view.state = state
            view.failure = failure
        })
    }

    private async restart(key: string): Promise<void> {
        this.mutate(key, (view) => {
            view.state = 'connecting'
            view.failure = ''
            view.revision += 1
            view.lineCount = 0
            view.dropped = 0
            view.autoscroll = true
        })

        await this.start(key)
    }

    private async start(key: string): Promise<void> {
        const view = this.views[key]
        if (!view) {
            return
        }

        try {
            await this.podLogsService.open({
                key,
                clusterId: view.clusterId,
                namespace: view.namespace,
                podName: view.podName,
                options: { ...view.options },
            }, this)
        } catch (err) {
            this.onState(key, 'failed', err instanceof ApiError ? err.message : PodLogsStore.unopenable)
            this.eventBus.emitEvent(new AppErrorEvent(err, 'PodLogsStore.start'))
        }
    }

    // A pod that has gone away still has logs worth reading, so a failed container list leaves the panel open.
    private async loadContainers(key: string): Promise<void> {
        const view = this.views[key]
        if (!view) {
            return
        }

        try {
            const containers = await this.podLogsService.containers(view.clusterId, view.namespace, view.podName)
            this.mutate(key, (open) => {
                open.containers = containers
            })
        } catch {
            this.mutate(key, (open) => {
                open.containers = []
            })
        }
    }

    private mutate(key: string, change: (view: TPodLogView) => void): void {
        const view = this.views[key]
        if (view) {
            change(view)
        }
    }

    private static blank(key: string, clusterId: string, namespace: string, podName: string): TPodLogView {
        return {
            key,
            clusterId,
            namespace,
            podName,
            containers: [],
            options: PodLogOptions.defaults(),
            state: 'connecting',
            failure: '',
            revision: 0,
            lineCount: 0,
            dropped: 0,
            search: '',
            onlyMatches: false,
            showContainer: false,
            wrap: false,
            autoscroll: true,
        }
    }
}
