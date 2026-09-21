import { inject } from 'tsyringe'
import { HelmService } from '@/application/services/helm/HelmService'
import { IdService } from '@/application/services/id/IdService'
import type { IHelmOperationSink } from '@/application/services/helm/types/IHelmOperationSink'
import type { THelmOperationKind } from '@/application/services/helm/types/THelmOperationKind'
import type { THelmInstallDraft } from '@/domain/entities/helm/types/THelmInstallDraft'
import type { THelmReleaseRef } from '@/domain/entities/helm/types/THelmReleaseRef'
import type { THelmUpgradeDraft } from '@/domain/entities/helm/types/THelmUpgradeDraft'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { HelmReleaseInstalledEvent } from '@/domain/events/helm/HelmReleaseInstalledEvent'
import { HelmReleaseRolledBackEvent } from '@/domain/events/helm/HelmReleaseRolledBackEvent'
import { HelmReleaseUninstalledEvent } from '@/domain/events/helm/HelmReleaseUninstalledEvent'
import { HelmReleaseUpgradedEvent } from '@/domain/events/helm/HelmReleaseUpgradedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'
import type { THelmOperationView } from '@/store/modules/helm/types/THelmOperationView'

@InjectableStore
export class HelmOperationStore extends StoreBase<HelmOperationStore> implements IHelmOperationSink {
    public operations: Record<string, THelmOperationView> = {}

    public activeKey = ''

    constructor(
        @inject(HelmService) private readonly helmService: HelmService,
        @inject(IdService) private readonly idService: IdService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public get active(): THelmOperationView | null {
        return this.operations[this.activeKey] ?? null
    }

    public get isRunning(): boolean {
        return Object.values(this.operations).some(operation => operation.state === 'running')
    }

    public viewOf(key: string): THelmOperationView | undefined {
        return this.operations[key]
    }

    public lines(key: string): readonly string[] {
        return this.helmService.lines(key)
    }

    public install(clusterId: string, draft: THelmInstallDraft): Promise<string> {
        return this.begin(
            {
                kind: 'install',
                clusterId,
                namespace: draft.namespace,
                releaseName: draft.releaseName,
                chart: draft.chart,
                targetRevision: 0,
                title: `Installing ${draft.releaseName} from ${draft.chart}`,
            },
            key => this.helmService.install(clusterId, key, draft, this),
        )
    }

    public upgrade(clusterId: string, draft: THelmUpgradeDraft): Promise<string> {
        return this.begin(
            {
                kind: 'upgrade',
                clusterId,
                namespace: draft.namespace,
                releaseName: draft.releaseName,
                chart: draft.chart,
                targetRevision: 0,
                title: `Upgrading ${draft.releaseName} to ${draft.chart}`,
            },
            key => this.helmService.upgrade(clusterId, key, draft, this),
        )
    }

    public uninstall(clusterId: string, ref: THelmReleaseRef, keepHistory: boolean): Promise<string> {
        return this.begin(
            {
                kind: 'uninstall',
                clusterId,
                namespace: ref.namespace,
                releaseName: ref.name,
                chart: '',
                targetRevision: 0,
                title: `Uninstalling ${ref.name}`,
            },
            key => this.helmService.uninstall(clusterId, key, ref, keepHistory, this),
        )
    }

    public rollback(clusterId: string, ref: THelmReleaseRef, revision: number): Promise<string> {
        return this.begin(
            {
                kind: 'rollback',
                clusterId,
                namespace: ref.namespace,
                releaseName: ref.name,
                chart: '',
                targetRevision: revision,
                title: `Rolling ${ref.name} back to revision ${revision}`,
            },
            key => this.helmService.rollback(clusterId, key, ref, revision, this),
        )
    }

    public onOperationOutput(key: string, lineCount: number): void {
        this.mutate(key, (view) => {
            view.lineCount = lineCount
            view.revision += 1
        })
    }

    public onOperationFinished(key: string, code: number): void {
        const view = this.operations[key]
        if (!view) {
            return
        }

        const cancelled = this.helmService.wasCancelled(key)
        this.mutate(key, (open) => {
            open.code = code
            open.state = cancelled ? 'cancelled' : (code === 0 ? 'succeeded' : 'failed')
            open.revision += 1
            open.lineCount = this.helmService.lines(key).length
        })

        if (cancelled) {
            return
        }
        if (code === 0) {
            this.eventBus.emitEvent(HelmOperationStore.eventOf(view))
            return
        }

        this.eventBus.emitEvent(new AppErrorEvent(
            new ApiError(`${view.title} failed`, this.helmService.text(key), code),
            'HelmOperationStore.finished',
        ))
    }

    public async cancel(key: string): Promise<void> {
        await this.helmService.cancel(key)
    }

    public close(key: string): void {
        const remaining = { ...this.operations }
        delete remaining[key]
        this.operations = remaining
        this.helmService.discard(key)

        if (this.activeKey === key) {
            this.activeKey = ''
        }
    }

    private async begin(
        view: Omit<THelmOperationView, 'key' | 'state' | 'code' | 'lineCount' | 'revision'>,
        action: (key: string) => Promise<void>,
    ): Promise<string> {
        const key = `${view.kind}-${this.idService.next()}`

        this.operations = {
            ...this.operations,
            [key]: { ...view, key, state: 'running', code: 0, lineCount: 0, revision: 0 },
        }
        this.activeKey = key

        try {
            await action(key)
        } catch (err) {
            this.mutate(key, (open) => {
                open.state = 'failed'
                open.revision += 1
            })
            this.eventBus.emitEvent(new AppErrorEvent(err, `HelmOperationStore.${view.kind}`))
        }

        return key
    }

    private mutate(key: string, change: (view: THelmOperationView) => void): void {
        const view = this.operations[key]
        if (view) {
            change(view)
        }
    }

    private static eventOf(view: THelmOperationView): object {
        const kind: THelmOperationKind = view.kind

        if (kind === 'install') {
            return new HelmReleaseInstalledEvent(view.clusterId, view.namespace, view.releaseName, view.chart)
        }
        if (kind === 'upgrade') {
            return new HelmReleaseUpgradedEvent(view.clusterId, view.namespace, view.releaseName, view.chart)
        }
        if (kind === 'rollback') {
            return new HelmReleaseRolledBackEvent(
                view.clusterId,
                view.namespace,
                view.releaseName,
                view.targetRevision,
            )
        }

        return new HelmReleaseUninstalledEvent(view.clusterId, view.namespace, view.releaseName)
    }
}
