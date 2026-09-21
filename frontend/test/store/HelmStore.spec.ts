import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = {
        availability: { available: true, executable: 'helm', version: 'v3.14.0', reason: '', detail: '' },
        releases: [] as unknown[],
        failWith: null as Error | null,
        detailFailure: null as Error | null,
    }

    return {
        state,
        availability: vi.fn(async () => state.availability),
        listReleases: vi.fn(async () => {
            if (state.failWith) {
                throw state.failWith
            }
            return state.releases
        }),
        values: vi.fn(async () => {
            if (state.detailFailure) {
                throw state.detailFailure
            }
            return 'replicaCount: 2\n'
        }),
        manifest: vi.fn(async () => 'apiVersion: v1\nkind: Service\nmetadata:\n  name: web\n'),
        notes: vi.fn(async () => 'Thank you.'),
        history: vi.fn(async () => []),
        resourcesOf: vi.fn(() => [{ apiVersion: 'v1', kind: 'Service', name: 'web', namespace: 'dev' }]),
        forget: vi.fn(),
        openInstallGuide: vi.fn(async () => undefined),
    }
})

vi.mock('@/application/services/helm/HelmService', () => ({
    HelmService: class {
        public availability = fake.availability

        public listReleases = fake.listReleases

        public values = fake.values

        public manifest = fake.manifest

        public notes = fake.notes

        public history = fake.history

        public resourcesOf = fake.resourcesOf

        public forget = fake.forget

        public openInstallGuide = fake.openInstallGuide
    },
}))

import { HelmReleaseEntity } from '@/domain/entities/helm/HelmReleaseEntity'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { HelmStore } from '@/store/modules/helm/HelmStore'

const store = container.resolve(HelmStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, event => void errors.push(event))

const release = (name: string) => HelmReleaseEntity.build({
    id: `dev/${name}`,
    name,
    namespace: 'dev',
    revision: 2,
    updated: '2026-05-01T10:11:12Z',
    status: 'deployed',
    chart: 'nginx-15.1.0',
    chartName: 'nginx',
    chartVersion: '15.1.0',
    appVersion: '1.25.3',
})

describe('HelmStore', () => {
    beforeEach(() => {
        errors.splice(0, errors.length)
        fake.state.availability = { available: true, executable: 'helm', version: 'v3.14.0', reason: '', detail: '' }
        fake.state.releases = []
        fake.state.failWith = null
        fake.state.detailFailure = null
        Object.values(fake).forEach(value => typeof value === 'function' && (value as any).mockClear?.())
        store.clusterId = ''
        store.close()
    })

    it('checks helm and loads the releases when entering a cluster', async () => {
        fake.state.releases = [release('web')]

        await store.enter('staging')

        expect(store.isAvailable).toBe(true)
        expect(store.checked).toBe(true)
        expect(store.releases).toHaveLength(1)
    })

    it('does not list anything when helm is not available', async () => {
        fake.state.availability = { available: false, executable: 'helm', version: '', reason: 'nope', detail: '' }

        await store.enter('staging')

        expect(fake.listReleases).not.toHaveBeenCalled()
        expect(store.releases).toEqual([])
    })

    it('sends the filters it holds into the query, one request per change', async () => {
        await store.enter('staging')
        fake.listReleases.mockClear()

        await store.setNamespace('dev')
        await store.setSearch('web')
        await store.setIncludeSuperseded(true)

        expect(fake.listReleases).toHaveBeenCalledTimes(3)
        expect(fake.listReleases).toHaveBeenLastCalledWith('staging', {
            namespace: 'dev',
            search: 'web',
            includeSuperseded: true,
        })
    })

    it('keeps a failure on screen and reports it once, without throwing outwards', async () => {
        fake.state.failWith = new ApiError('Error: Kubernetes cluster unreachable', 'dial tcp: i/o timeout')

        await store.enter('staging')

        expect(store.error).toBe('Error: Kubernetes cluster unreachable')
        expect(store.errorDetail).toBe('dial tcp: i/o timeout')
        expect(errors).toHaveLength(1)
    })

    it('reads values, manifest, notes, history and the rendered objects in one open', async () => {
        fake.state.releases = [release('web')]
        await store.enter('staging')

        await store.open(store.releases[0])

        expect(store.detail?.values).toBe('replicaCount: 2\n')
        expect(store.detail?.resources).toHaveLength(1)
        expect(fake.values).toHaveBeenCalledTimes(2)
    })

    it('shows why a release could not be read instead of a blank panel', async () => {
        fake.state.releases = [release('web')]
        await store.enter('staging')
        fake.state.detailFailure = new ApiError('Error: release: not found', 'exit 1')

        await store.open(store.releases[0])

        expect(store.detail).toBeNull()
        expect(store.detailError).toBe('Error: release: not found')
    })

    it('reloads the open release after an operation touched it', async () => {
        fake.state.releases = [release('web')]
        await store.enter('staging')
        await store.open(store.releases[0])
        fake.values.mockClear()

        await store.refreshAfterOperation({ name: 'web', namespace: 'dev' })

        expect(fake.values).toHaveBeenCalled()
    })

    it('leaves a release that is not open alone after an operation elsewhere', async () => {
        fake.state.releases = [release('web')]
        await store.enter('staging')
        fake.values.mockClear()

        await store.refreshAfterOperation({ name: 'other', namespace: 'dev' })

        expect(fake.values).not.toHaveBeenCalled()
    })

    it('forgets everything it knew when the cluster changes', async () => {
        fake.state.releases = [release('web')]
        await store.enter('staging')

        fake.state.releases = []
        await store.enter('production')

        expect(store.releases).toEqual([])
        expect(store.namespace).toBe('')
    })
})
