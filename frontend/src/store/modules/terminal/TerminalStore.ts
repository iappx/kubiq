import { inject } from 'tsyringe'
import { IdService } from '@/application/services/id/IdService'
import { TerminalLabel } from '@/application/services/terminal/models/TerminalLabel'
import { TerminalService } from '@/application/services/terminal/TerminalService'
import type { ITerminalSink } from '@/application/services/terminal/types/ITerminalSink'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { TerminalKey } from '@/domain/models/terminal'
import type { TTerminalHint, TTerminalKind, TTerminalState } from '@/domain/models/terminal'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'
import type { TTerminalView } from '@/store/modules/terminal/types/TTerminalView'

@InjectableStore
export class TerminalStore extends StoreBase<TerminalStore> implements ITerminalSink {
    public views: Record<string, TTerminalView> = {}

    public nodes: string[] = []

    public loadingNodes = false

    constructor(
        @inject(TerminalService) private readonly terminalService: TerminalService,
        @inject(IdService) private readonly idService: IdService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public viewOf(key: string): TTerminalView | undefined {
        return this.views[key]
    }

    public has(key: string): boolean {
        return key in this.views
    }

    public openExec(clusterId: string, namespace: string, podName: string, containerName: string): string {
        const key = this.register(clusterId, 'exec', TerminalLabel.forPod(podName, containerName), {
            namespace,
            podName,
            containerName,
        })

        void this.start(key)
        void this.loadContainers(key)

        return key
    }

    public openNodeShell(clusterId: string, nodeName: string): string {
        const key = this.register(clusterId, 'node', TerminalLabel.forNode(nodeName), { nodeName })

        void this.start(key)

        return key
    }

    public openLocalShell(clusterId: string, namespace: string): string {
        const key = this.register(clusterId, 'local', TerminalLabel.forLocal(clusterId), { namespace })

        void this.start(key)

        return key
    }

    public selectContainer(key: string, containerName: string): Promise<void> {
        const view = this.views[key]
        if (!view || view.containerName === containerName) {
            return Promise.resolve()
        }

        this.mutate(key, (current) => {
            current.containerName = containerName
            current.title = TerminalLabel.forPod(current.podName, containerName)
        })

        return this.restart(key)
    }

    public async loadContainers(key: string): Promise<void> {
        const view = this.views[key]
        if (!view || view.kind !== 'exec') {
            return
        }

        try {
            const containers = await this.terminalService.containers(view.clusterId, view.namespace, view.podName)
            this.mutate(key, (current) => {
                current.containers = containers
            })
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'TerminalStore.loadContainers'))
        }
    }

    public restart(key: string): Promise<void> {
        const view = this.views[key]
        if (!view) {
            return Promise.resolve()
        }

        this.mutate(key, (current) => {
            current.state = 'starting'
            current.failure = ''
            current.hint = 'none'
        })

        return this.start(key)
    }

    public write(key: string, data: Uint8Array): void {
        void this.guard(key, () => this.terminalService.write(key, data))
    }

    public resize(key: string, cols: number, rows: number): void {
        void this.guard(key, () => this.terminalService.resize(key, cols, rows))
    }

    public async loadNodes(clusterId: string): Promise<void> {
        this.loadingNodes = true
        try {
            this.nodes = await this.terminalService.listNodes(clusterId)
        } catch (err) {
            this.nodes = []
            this.eventBus.emitEvent(new AppErrorEvent(err, 'TerminalStore.loadNodes'))
        } finally {
            this.loadingNodes = false
        }
    }

    public openLink(url: string): void {
        void this.guard('openLink', () => this.terminalService.openLink(url))
    }

    public attachView(key: string, write: (data: Uint8Array) => void): void {
        this.terminalService.attachView(key, write)
    }

    public detachView(key: string): void {
        this.terminalService.detachView(key)
    }

    public async close(key: string): Promise<void> {
        const remaining: Record<string, TTerminalView> = { ...this.views }
        delete remaining[key]
        this.views = remaining

        await this.guard(key, () => this.terminalService.close(key))
    }

    public async closeCluster(clusterId: string): Promise<void> {
        const remaining: Record<string, TTerminalView> = {}
        Object.values(this.views).forEach((view) => {
            if (view.clusterId !== clusterId) {
                remaining[view.key] = view
            }
        })
        this.views = remaining

        await this.terminalService.closeCluster(clusterId)
    }

    public async closeAll(): Promise<void> {
        this.views = {}

        await this.terminalService.closeAll()
    }

    public onState(key: string, state: TTerminalState, failure: string, hint: TTerminalHint): void {
        this.mutate(key, (view) => {
            view.state = state
            view.failure = failure
            view.hint = hint
        })
    }

    private register(
        clusterId: string,
        kind: TTerminalKind,
        title: string,
        target: Partial<TTerminalView>,
    ): string {
        const key = TerminalKey.of(clusterId, this.idService.next())

        this.views = {
            ...this.views,
            [key]: {
                key,
                clusterId,
                kind,
                title,
                namespace: '',
                podName: '',
                containerName: '',
                containers: [],
                nodeName: '',
                state: 'starting',
                failure: '',
                hint: 'none',
                ...target,
            },
        }

        return key
    }

    private start(key: string): Promise<void> {
        const view = this.views[key]
        if (!view) {
            return Promise.resolve()
        }

        return this.guard(key, () => {
            if (view.kind === 'exec') {
                return this.terminalService.openExec(key, {
                    clusterId: view.clusterId,
                    namespace: view.namespace,
                    podName: view.podName,
                    containerName: view.containerName,
                }, this)
            }
            if (view.kind === 'node') {
                return this.terminalService.openNodeShell(key, {
                    clusterId: view.clusterId,
                    nodeName: view.nodeName,
                }, this)
            }

            return this.terminalService.openLocalShell(key, {
                clusterId: view.clusterId,
                namespace: view.namespace,
            }, this)
        })
    }

    private async guard(key: string, action: () => Promise<void>): Promise<void> {
        try {
            await action()
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, `TerminalStore:${key}`))
        }
    }

    private mutate(key: string, change: (view: TTerminalView) => void): void {
        const view = this.views[key]
        if (!view) {
            return
        }

        const updated = { ...view }
        change(updated)
        this.views = { ...this.views, [key]: updated }
    }
}
