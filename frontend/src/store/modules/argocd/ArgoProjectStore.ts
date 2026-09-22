import { inject } from 'tsyringe'
import { ArgoService } from '@/application/services/argocd/ArgoService'
import { ArgoApplicationSetEntity } from '@/domain/entities/argocd/ArgoApplicationSetEntity'
import { ArgoAppProjectEntity } from '@/domain/entities/argocd/ArgoAppProjectEntity'
import { KubeObjectKey } from '@/domain/entities/kube'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import type { TArgoCapabilities } from '@/domain/models/argocd'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class ArgoProjectStore extends StoreBase<ArgoProjectStore> {
    public static readonly unreadable: string = 'Could not read the Argo CD projects'

    public clusterId = ''

    public capabilities: TArgoCapabilities = {}

    public projects: ArgoAppProjectEntity[] = []

    public applicationSets: ArgoApplicationSetEntity[] = []

    public loading = false

    public loaded = false

    public error = ''

    public errorDetail = ''

    public selectedProjectKey = ''

    public selectedSetKey = ''

    constructor(
        @inject(ArgoService) private readonly argoService: ArgoService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public get hasProjects(): boolean {
        return this.capabilities.appProjects !== undefined
    }

    public get hasApplicationSets(): boolean {
        return this.capabilities.applicationSets !== undefined
    }

    public get selectedProject(): ArgoAppProjectEntity | null {
        return this.projects.find(project => KubeObjectKey.of(project) === this.selectedProjectKey) ?? null
    }

    public get selectedSet(): ArgoApplicationSetEntity | null {
        return this.applicationSets.find(set => KubeObjectKey.of(set) === this.selectedSetKey) ?? null
    }

    public async enter(clusterId: string, capabilities: TArgoCapabilities): Promise<void> {
        const moved = this.clusterId !== clusterId
        this.clusterId = clusterId
        this.capabilities = capabilities
        if (moved) {
            this.reset()
        }

        await this.loadOnce()
    }

    public loadOnce(): Promise<void> {
        return this.loaded ? Promise.resolve() : this.load()
    }

    public load(): Promise<void> {
        return this.guard('ArgoProjectStore.load', async () => {
            this.loading = true
            this.clearFailure()
            try {
                const [projects, sets] = await Promise.all([
                    this.readProjects(),
                    this.readApplicationSets(),
                ])
                this.projects = projects
                this.applicationSets = sets
                this.loaded = true
            } catch (err) {
                this.rememberFailure(err)
                throw err
            } finally {
                this.loading = false
            }
        })
    }

    public openProject(key: string): void {
        this.selectedProjectKey = key
    }

    public closeProject(): void {
        this.selectedProjectKey = ''
    }

    public openSet(key: string): void {
        this.selectedSetKey = key
    }

    public closeSet(): void {
        this.selectedSetKey = ''
    }

    public forget(clusterId: string): void {
        if (this.clusterId !== clusterId) {
            return
        }

        this.reset()
        this.clusterId = ''
        this.capabilities = {}
    }

    private readProjects(): Promise<ArgoAppProjectEntity[]> {
        const kind = this.capabilities.appProjects

        return kind ? this.argoService.listProjects(this.clusterId, kind) : Promise.resolve([])
    }

    private readApplicationSets(): Promise<ArgoApplicationSetEntity[]> {
        const kind = this.capabilities.applicationSets

        return kind ? this.argoService.listApplicationSets(this.clusterId, kind) : Promise.resolve([])
    }

    private reset(): void {
        this.projects = []
        this.applicationSets = []
        this.loaded = false
        this.closeProject()
        this.closeSet()
        this.clearFailure()
    }

    private clearFailure(): void {
        this.error = ''
        this.errorDetail = ''
    }

    private rememberFailure(err: unknown): void {
        this.error = err instanceof ApiError ? err.message : ArgoProjectStore.unreadable
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
