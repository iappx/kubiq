import { inject } from 'tsyringe'
import { ArgoService } from '@/application/services/argocd/ArgoService'
import type { TArgoApplicationTarget } from '@/application/services/argocd/types/TArgoApplicationTarget'
import { ArgoApplicationEntity } from '@/domain/entities/argocd/ArgoApplicationEntity'
import type { TArgoApplicationSource } from '@/domain/entities/argocd/types/TArgoApplicationSource'
import type { TArgoAutomatedSyncPolicy } from '@/domain/entities/argocd/types/TArgoAutomatedSyncPolicy'
import type { TArgoHealthStatus } from '@/domain/entities/argocd/types/TArgoHealthStatus'
import type { TArgoSyncDraft } from '@/domain/entities/argocd/types/TArgoSyncDraft'
import type { TArgoSyncStatus } from '@/domain/entities/argocd/types/TArgoSyncStatus'
import { KubeObjectKey } from '@/domain/entities/kube'
import { ArgoApplicationDeletedEvent } from '@/domain/events/argocd/ArgoApplicationDeletedEvent'
import { ArgoAutoSyncChangedEvent } from '@/domain/events/argocd/ArgoAutoSyncChangedEvent'
import { ArgoRefreshRequestedEvent } from '@/domain/events/argocd/ArgoRefreshRequestedEvent'
import { ArgoSyncRequestedEvent } from '@/domain/events/argocd/ArgoSyncRequestedEvent'
import { ArgoSyncTerminatedEvent } from '@/domain/events/argocd/ArgoSyncTerminatedEvent'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { ArgoCapabilities } from '@/domain/models/argocd'
import type { TArgoCapabilities } from '@/domain/models/argocd'
import type { KubeResourceKind } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class ArgoStore extends StoreBase<ArgoStore> {
    public static readonly unreadable: string = 'Could not read the Argo CD applications'

    public clusterId = ''

    public capabilities: TArgoCapabilities = {}

    public applications: ArgoApplicationEntity[] = []

    public loading = false

    public loaded = false

    public error = ''

    public errorDetail = ''

    public search = ''

    public syncFilter: TArgoSyncStatus | '' = ''

    public healthFilter: TArgoHealthStatus | '' = ''

    public selectedKey = ''

    public busyKeys: string[] = []

    constructor(
        @inject(ArgoService) private readonly argoService: ArgoService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public get isInstalled(): boolean {
        return ArgoCapabilities.isInstalled(this.capabilities)
    }

    public get canSync(): boolean {
        return ArgoCapabilities.canSync(this.capabilities)
    }

    public get canDelete(): boolean {
        return ArgoCapabilities.canDelete(this.capabilities)
    }

    public get selected(): ArgoApplicationEntity | null {
        return this.applications.find(application => KubeObjectKey.of(application) === this.selectedKey) ?? null
    }

    public get isBusy(): boolean {
        return this.busyKeys.length > 0
    }

    public get hasFilters(): boolean {
        return this.search !== '' || this.syncFilter !== '' || this.healthFilter !== ''
    }

    public keyOf(application: ArgoApplicationEntity): string {
        return KubeObjectKey.of(application)
    }

    public async enter(clusterId: string, capabilities: TArgoCapabilities): Promise<void> {
        const moved = this.clusterId !== clusterId
        this.clusterId = clusterId
        this.capabilities = capabilities
        if (moved) {
            this.reset()
        }

        if (this.isInstalled) {
            await this.load()
        }
    }

    public load(): Promise<void> {
        return this.guard('ArgoStore.load', async () => {
            const kind = this.capabilities.applications
            if (!kind) {
                return
            }

            this.loading = true
            this.clearFailure()
            try {
                this.applications = await this.argoService.listApplications(this.clusterId, kind)
                this.loaded = true
            } catch (err) {
                this.rememberFailure(err)
                throw err
            } finally {
                this.loading = false
            }
        })
    }

    public setSearch(search: string): void {
        this.search = search
    }

    public setSyncFilter(status: TArgoSyncStatus | ''): void {
        this.syncFilter = status
    }

    public setHealthFilter(status: TArgoHealthStatus | ''): void {
        this.healthFilter = status
    }

    public clearFilters(): void {
        this.search = ''
        this.syncFilter = ''
        this.healthFilter = ''
    }

    public open(key: string): void {
        this.selectedKey = key
    }

    public close(): void {
        this.selectedKey = ''
    }

    public sync(application: ArgoApplicationEntity, draft: TArgoSyncDraft): Promise<void> {
        return this.act(application, 'ArgoStore.sync', async (target) => {
            await this.argoService.sync(target, draft, ArgoStore.sourceFor(application, draft))
            this.eventBus.emitEvent(new ArgoSyncRequestedEvent(
                this.clusterId,
                application.namespace,
                application.name,
                draft.revision.trim(),
                draft.dryRun,
            ))
        })
    }

    public refresh(application: ArgoApplicationEntity, hard: boolean): Promise<void> {
        return this.act(application, 'ArgoStore.refresh', async (target) => {
            await this.argoService.refresh(target, hard)
            this.eventBus.emitEvent(new ArgoRefreshRequestedEvent(
                this.clusterId,
                application.namespace,
                application.name,
                hard,
            ))
        })
    }

    public terminate(application: ArgoApplicationEntity): Promise<void> {
        return this.act(application, 'ArgoStore.terminate', async (target) => {
            await this.argoService.terminate(target)
            this.eventBus.emitEvent(new ArgoSyncTerminatedEvent(
                this.clusterId,
                application.namespace,
                application.name,
            ))
        })
    }

    public setAutomatedSync(
        application: ArgoApplicationEntity,
        automated: TArgoAutomatedSyncPolicy | null,
    ): Promise<void> {
        return this.act(application, 'ArgoStore.setAutomatedSync', async (target) => {
            await this.argoService.setAutomatedSync(target, automated)
            this.eventBus.emitEvent(new ArgoAutoSyncChangedEvent(
                this.clusterId,
                application.namespace,
                application.name,
                automated !== null,
            ))
        })
    }

    public remove(application: ArgoApplicationEntity, cascade: boolean): Promise<void> {
        return this.act(application, 'ArgoStore.remove', async (target) => {
            await this.argoService.remove(target, cascade, application.metadata?.finalizers ?? [])
            this.close()
            this.eventBus.emitEvent(new ArgoApplicationDeletedEvent(
                this.clusterId,
                application.namespace,
                application.name,
                cascade,
            ))
        })
    }

    public forget(clusterId: string): void {
        if (this.clusterId !== clusterId) {
            return
        }

        this.reset()
        this.clusterId = ''
        this.capabilities = {}
    }

    // Rolling back is a sync at a revision the application once ran, and Argo CD replays the
    // source that revision was deployed from, not whatever the spec points at today.
    private static sourceFor(
        application: ArgoApplicationEntity,
        draft: TArgoSyncDraft,
    ): TArgoApplicationSource | undefined {
        const revision = draft.revision.trim()
        if (revision === '') {
            return undefined
        }

        return application.history.find(entry => entry.revision === revision)?.source
    }

    private async act(
        application: ArgoApplicationEntity,
        context: string,
        action: (target: TArgoApplicationTarget) => Promise<void>,
    ): Promise<void> {
        const kind = this.capabilities.applications
        if (!kind) {
            return
        }

        const key = KubeObjectKey.of(application)
        this.busyKeys = [...this.busyKeys, key]
        try {
            await action(ArgoStore.targetOf(this.clusterId, kind, application))
            await this.load()
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, context))
        } finally {
            this.busyKeys = this.busyKeys.filter(busy => busy !== key)
        }
    }

    private static targetOf(
        clusterId: string,
        kind: KubeResourceKind,
        application: ArgoApplicationEntity,
    ): TArgoApplicationTarget {
        return {
            clusterId,
            kind,
            namespace: application.namespace,
            name: application.name,
        }
    }

    private reset(): void {
        this.applications = []
        this.loaded = false
        this.clearFilters()
        this.close()
        this.clearFailure()
    }

    private clearFailure(): void {
        this.error = ''
        this.errorDetail = ''
    }

    private rememberFailure(err: unknown): void {
        this.error = err instanceof ApiError ? err.message : ArgoStore.unreadable
        this.errorDetail = err instanceof ApiError ? err.details ?? '' : ''
    }

    private async guard(context: string, action: () => Promise<void>): Promise<void> {
        try {
            await action()
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, context))
        }
    }
}
