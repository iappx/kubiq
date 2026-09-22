import { inject } from 'tsyringe'
import { HelmService } from '@/application/services/helm/HelmService'
import { HelmReleaseEntity } from '@/domain/entities/helm/HelmReleaseEntity'
import type { THelmReleaseRef } from '@/domain/entities/helm/types/THelmReleaseRef'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { HelmReleaseKey } from '@/domain/models/helm/HelmReleaseKey'
import type { THelmAvailability } from '@/domain/models/helm/types/THelmAvailability'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'
import type { THelmReleaseDetail } from '@/store/modules/helm/types/THelmReleaseDetail'

@InjectableStore
export class HelmStore extends StoreBase<HelmStore> {
    public static readonly unreadable: string = 'Could not read the Helm releases'

    public clusterId = ''

    public availability: THelmAvailability = HelmStore.blankAvailability()

    public checking = false

    public checked = false

    public releases: HelmReleaseEntity[] = []

    public loading = false

    public error = ''

    public errorDetail = ''

    public namespaces: string[] = []

    public search = ''

    public includeSuperseded = false

    public selectedId = ''

    public detail: THelmReleaseDetail | null = null

    public detailLoading = false

    public detailError = ''

    public detailErrorDetail = ''

    constructor(
        @inject(HelmService) private readonly helmService: HelmService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public get isAvailable(): boolean {
        return this.availability.available
    }

    public get selected(): HelmReleaseEntity | null {
        return this.releases.find(release => release.id === this.selectedId) ?? null
    }

    public async enter(clusterId: string, namespaces: readonly string[] = []): Promise<void> {
        if (this.clusterId !== clusterId) {
            this.clusterId = clusterId
            this.reset()
        }
        this.namespaces = [...namespaces]

        await this.check(false)
        if (this.availability.available) {
            await this.load()
        }
    }

    public check(refresh: boolean): Promise<void> {
        return this.guard('HelmStore.check', async () => {
            this.checking = true
            try {
                this.availability = await this.helmService.availability(this.clusterId, refresh)
                this.checked = true
            } finally {
                this.checking = false
            }
        })
    }

    public async retry(): Promise<void> {
        await this.check(true)
        if (this.availability.available) {
            await this.load()
        }
    }

    public openInstallGuide(): Promise<void> {
        return this.guard('HelmStore.openInstallGuide', () => this.helmService.openInstallGuide())
    }

    public load(): Promise<void> {
        return this.guard('HelmStore.load', async () => {
            this.loading = true
            this.clearFailure()
            try {
                this.releases = await this.helmService.listReleases(this.clusterId, {
                    namespaces: this.namespaces,
                    search: this.search,
                    includeSuperseded: this.includeSuperseded,
                })
            } catch (err) {
                this.rememberFailure(err)
                throw err
            } finally {
                this.loading = false
            }
        })
    }

    public setNamespaces(namespaces: readonly string[]): Promise<void> {
        this.namespaces = [...namespaces]

        return this.isAvailable ? this.load() : Promise.resolve()
    }

    public setSearch(search: string): Promise<void> {
        this.search = search

        return this.load()
    }

    public setIncludeSuperseded(include: boolean): Promise<void> {
        this.includeSuperseded = include

        return this.load()
    }

    public clearFilters(): Promise<void> {
        this.search = ''

        return this.load()
    }

    public close(): void {
        this.selectedId = ''
        this.detail = null
        this.detailError = ''
        this.detailErrorDetail = ''
    }

    public open(release: HelmReleaseEntity): Promise<void> {
        this.selectedId = release.id

        return this.loadDetail({ name: release.name, namespace: release.namespace })
    }

    public reopen(): Promise<void> {
        const release = this.selected
        if (!release) {
            return Promise.resolve()
        }

        return this.loadDetail({ name: release.name, namespace: release.namespace })
    }

    public loadDetail(ref: THelmReleaseRef): Promise<void> {
        return this.guard('HelmStore.loadDetail', async () => {
            this.detailLoading = true
            this.detailError = ''
            this.detailErrorDetail = ''
            try {
                const [values, computedValues, manifest, notes, revisions] = await Promise.all([
                    this.helmService.values(this.clusterId, ref, false),
                    this.helmService.values(this.clusterId, ref, true),
                    this.helmService.manifest(this.clusterId, ref),
                    this.helmService.notes(this.clusterId, ref),
                    this.helmService.history(this.clusterId, ref),
                ])

                this.detail = {
                    namespace: ref.namespace,
                    name: ref.name,
                    values,
                    computedValues,
                    manifest,
                    notes,
                    resources: this.helmService.resourcesOf(manifest, ref.namespace),
                    revisions,
                }
            } catch (err) {
                this.detail = null
                this.detailError = err instanceof ApiError ? err.message : HelmStore.unreadable
                this.detailErrorDetail = err instanceof ApiError ? err.details ?? '' : ''
                throw err
            } finally {
                this.detailLoading = false
            }
        })
    }

    public async refreshAfterOperation(ref: THelmReleaseRef): Promise<void> {
        await this.load()

        if (this.selectedId === HelmReleaseKey.of(ref.namespace, ref.name) && this.selected) {
            await this.loadDetail(ref)
        }
    }

    public forget(clusterId: string): void {
        this.helmService.forget(clusterId)
        if (this.clusterId === clusterId) {
            this.reset()
            this.clusterId = ''
        }
    }

    private reset(): void {
        this.releases = []
        this.checked = false
        this.availability = HelmStore.blankAvailability()
        this.namespaces = []
        this.search = ''
        this.includeSuperseded = false
        this.clearFailure()
        this.close()
    }

    private clearFailure(): void {
        this.error = ''
        this.errorDetail = ''
    }

    private rememberFailure(err: unknown): void {
        this.error = err instanceof ApiError ? err.message : HelmStore.unreadable
        this.errorDetail = err instanceof ApiError ? err.details ?? '' : ''
    }

    private async guard(context: string, action: () => Promise<void>): Promise<void> {
        try {
            await action()
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, context))
        }
    }

    private static blankAvailability(): THelmAvailability {
        return { available: false, executable: '', version: '', reason: '', detail: '' }
    }
}
