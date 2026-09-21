import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = {
        repositories: [] as unknown[],
        charts: [] as unknown[],
        failWith: null as Error | null,
    }

    return {
        state,
        repositories: vi.fn(async () => state.repositories),
        addRepository: vi.fn(async () => undefined),
        removeRepository: vi.fn(async () => undefined),
        updateRepositories: vi.fn(async () => undefined),
        searchCharts: vi.fn(async () => {
            if (state.failWith) {
                throw state.failWith
            }
            return state.charts
        }),
        chartReadme: vi.fn(async () => '# nginx'),
        chartValues: vi.fn(async () => 'replicaCount: 1\n'),
    }
})

vi.mock('@/application/services/helm/HelmService', () => ({
    HelmService: class {
        public repositories = fake.repositories

        public addRepository = fake.addRepository

        public removeRepository = fake.removeRepository

        public updateRepositories = fake.updateRepositories

        public searchCharts = fake.searchCharts

        public chartReadme = fake.chartReadme

        public chartValues = fake.chartValues
    },
}))

import { HelmChartEntity } from '@/domain/entities/helm/HelmChartEntity'
import { HelmRepositoryEntity } from '@/domain/entities/helm/HelmRepositoryEntity'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { HelmRepositoriesChangedEvent } from '@/domain/events/helm/HelmRepositoriesChangedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { HelmRepositoryStore } from '@/store/modules/helm/HelmRepositoryStore'

const store = container.resolve(HelmRepositoryStore)
const eventBus = container.resolve(EventBus)

const changes: HelmRepositoriesChangedEvent[] = []
const errors: AppErrorEvent[] = []
eventBus.registerHandler(HelmRepositoriesChangedEvent, event => void changes.push(event))
eventBus.registerHandler(AppErrorEvent, event => void errors.push(event))

const chart = HelmChartEntity.build({
    id: 'bitnami/nginx@15.1.0',
    ref: 'bitnami/nginx',
    repoName: 'bitnami',
    chartName: 'nginx',
    version: '15.1.0',
    appVersion: '1.25.3',
    description: 'A web server',
})

describe('HelmRepositoryStore', () => {
    beforeEach(() => {
        changes.splice(0, changes.length)
        errors.splice(0, errors.length)
        fake.state.repositories = [HelmRepositoryEntity.build({ name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' })]
        fake.state.charts = []
        fake.state.failWith = null
        Object.values(fake).forEach(value => typeof value === 'function' && (value as any).mockClear?.())
        store.clusterId = ''
    })

    it('loads the repositories of the cluster it was entered with', async () => {
        await store.enter('staging')

        expect(store.repositoryNames).toEqual(['bitnami'])
    })

    it('reloads and announces after a repository was added', async () => {
        await store.enter('staging')
        fake.repositories.mockClear()

        await store.add({ name: 'stable', url: 'https://charts.example.com' })

        expect(fake.addRepository).toHaveBeenCalledWith('staging', { name: 'stable', url: 'https://charts.example.com' })
        expect(fake.repositories).toHaveBeenCalled()
        expect(changes).toHaveLength(1)
    })

    it('announces a removal and an index update as well', async () => {
        await store.enter('staging')

        await store.remove('bitnami')
        await store.update()

        expect(fake.removeRepository).toHaveBeenCalledWith('staging', 'bitnami')
        expect(fake.updateRepositories).toHaveBeenCalledWith('staging')
        expect(changes.map(event => event.message)).toEqual([
            'Removed the chart repository "bitnami"',
            'Chart repositories updated',
        ])
    })

    it('sends the keyword, the repository and the version switch into one search', async () => {
        await store.enter('staging')

        await store.setKeyword('nginx')
        await store.setRepoFilter('bitnami')
        await store.setAllVersions(true)

        expect(fake.searchCharts).toHaveBeenLastCalledWith('staging', 'nginx', 'bitnami', true)
        expect(store.searched).toBe(true)
    })

    it('keeps a failed search on screen and reports it once', async () => {
        await store.enter('staging')
        fake.state.failWith = new ApiError('Error: no repositories configured', 'exit 1')

        await store.search()

        expect(store.chartsError).toBe('Error: no repositories configured')
        expect(errors).toHaveLength(1)
    })

    it('reads the readme and the default values of the chart it opens', async () => {
        await store.enter('staging')
        fake.state.charts = [chart]
        await store.search()

        await store.openChart(chart)

        expect(store.chartDetail).toEqual({
            ref: 'bitnami/nginx',
            version: '15.1.0',
            readme: '# nginx',
            values: 'replicaCount: 1\n',
        })
        expect(store.selectedChart?.id).toBe('bitnami/nginx@15.1.0')
    })
})
