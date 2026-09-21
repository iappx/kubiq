import { inject } from 'tsyringe'
import { HelmService } from '@/application/services/helm/HelmService'
import { HelmChartEntity } from '@/domain/entities/helm/HelmChartEntity'
import { HelmRepositoryEntity } from '@/domain/entities/helm/HelmRepositoryEntity'
import type { THelmRepositoryDraft } from '@/domain/entities/helm/types/THelmRepositoryDraft'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { HelmRepositoriesChangedEvent } from '@/domain/events/helm/HelmRepositoriesChangedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'
import type { THelmChartDetail } from '@/store/modules/helm/types/THelmChartDetail'

@InjectableStore
export class HelmRepositoryStore extends StoreBase<HelmRepositoryStore> {
    public static readonly unreadable: string = 'Could not read the Helm repositories'

    public static readonly unsearchable: string = 'Could not search the chart repositories'

    public clusterId = ''

    public repositories: HelmRepositoryEntity[] = []

    public loading = false

    public busy = false

    public error = ''

    public errorDetail = ''

    public charts: HelmChartEntity[] = []

    public chartsLoading = false

    public chartsError = ''

    public chartsErrorDetail = ''

    public searched = false

    public keyword = ''

    public repoFilter = ''

    public allVersions = false

    public selectedChartId = ''

    public chartDetail: THelmChartDetail | null = null

    public chartDetailLoading = false

    public chartDetailError = ''

    constructor(
        @inject(HelmService) private readonly helmService: HelmService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public get repositoryNames(): string[] {
        return this.repositories.map(repository => repository.name)
    }

    public get selectedChart(): HelmChartEntity | null {
        return this.charts.find(chart => chart.id === this.selectedChartId) ?? null
    }

    public async enter(clusterId: string): Promise<void> {
        if (this.clusterId !== clusterId) {
            this.clusterId = clusterId
            this.reset()
        }

        await this.load()
    }

    public load(): Promise<void> {
        return this.guard('HelmRepositoryStore.load', async () => {
            this.loading = true
            this.error = ''
            this.errorDetail = ''
            try {
                this.repositories = await this.helmService.repositories(this.clusterId)
            } catch (err) {
                this.error = err instanceof ApiError ? err.message : HelmRepositoryStore.unreadable
                this.errorDetail = err instanceof ApiError ? err.details ?? '' : ''
                throw err
            } finally {
                this.loading = false
            }
        })
    }

    public add(draft: THelmRepositoryDraft): Promise<void> {
        return this.change('HelmRepositoryStore.add', async () => {
            await this.helmService.addRepository(this.clusterId, {
                name: draft.name.trim(),
                url: draft.url.trim(),
            })
            this.announce(`Added the chart repository "${draft.name.trim()}"`)
        })
    }

    public remove(name: string): Promise<void> {
        return this.change('HelmRepositoryStore.remove', async () => {
            await this.helmService.removeRepository(this.clusterId, name)
            this.announce(`Removed the chart repository "${name}"`)
        })
    }

    public update(): Promise<void> {
        return this.change('HelmRepositoryStore.update', async () => {
            await this.helmService.updateRepositories(this.clusterId)
            this.announce('Chart repositories updated')
        })
    }

    public setKeyword(keyword: string): Promise<void> {
        this.keyword = keyword

        return this.search()
    }

    public setRepoFilter(repoName: string): Promise<void> {
        this.repoFilter = repoName

        return this.search()
    }

    public setAllVersions(allVersions: boolean): Promise<void> {
        this.allVersions = allVersions

        return this.search()
    }

    public search(): Promise<void> {
        return this.guard('HelmRepositoryStore.search', async () => {
            this.chartsLoading = true
            this.chartsError = ''
            this.chartsErrorDetail = ''
            try {
                this.charts = await this.helmService.searchCharts(
                    this.clusterId,
                    this.keyword,
                    this.repoFilter,
                    this.allVersions,
                )
                this.searched = true
            } catch (err) {
                this.chartsError = err instanceof ApiError ? err.message : HelmRepositoryStore.unsearchable
                this.chartsErrorDetail = err instanceof ApiError ? err.details ?? '' : ''
                throw err
            } finally {
                this.chartsLoading = false
            }
        })
    }

    public openChart(chart: HelmChartEntity): Promise<void> {
        this.selectedChartId = chart.id

        return this.guard('HelmRepositoryStore.openChart', async () => {
            this.chartDetailLoading = true
            this.chartDetailError = ''
            try {
                const [readme, values] = await Promise.all([
                    this.helmService.chartReadme(this.clusterId, chart.ref, chart.version),
                    this.helmService.chartValues(this.clusterId, chart.ref, chart.version),
                ])
                this.chartDetail = { ref: chart.ref, version: chart.version, readme, values }
            } catch (err) {
                this.chartDetail = null
                this.chartDetailError = err instanceof ApiError ? err.message : 'Could not read the chart'
                throw err
            } finally {
                this.chartDetailLoading = false
            }
        })
    }

    public closeChart(): void {
        this.selectedChartId = ''
        this.chartDetail = null
        this.chartDetailError = ''
    }

    public forget(clusterId: string): void {
        if (this.clusterId === clusterId) {
            this.reset()
            this.clusterId = ''
        }
    }

    private announce(message: string): void {
        this.eventBus.emitEvent(new HelmRepositoriesChangedEvent(this.clusterId, message))
    }

    private change(context: string, action: () => Promise<void>): Promise<void> {
        return this.guard(context, async () => {
            this.busy = true
            try {
                await action()
                await this.helmService.repositories(this.clusterId).then((repositories) => {
                    this.repositories = repositories
                })
            } finally {
                this.busy = false
            }
        })
    }

    private reset(): void {
        this.repositories = []
        this.charts = []
        this.searched = false
        this.keyword = ''
        this.repoFilter = ''
        this.allVersions = false
        this.error = ''
        this.errorDetail = ''
        this.chartsError = ''
        this.chartsErrorDetail = ''
        this.closeChart()
    }

    private async guard(context: string, action: () => Promise<void>): Promise<void> {
        try {
            await action()
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, context))
        }
    }
}
