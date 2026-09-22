import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = {
        applications: [] as unknown[],
        failWith: null as Error | null,
    }

    return {
        state,
        listApplications: vi.fn(async () => {
            if (state.failWith) {
                throw state.failWith
            }
            return state.applications
        }),
        listProjects: vi.fn(async () => []),
        listApplicationSets: vi.fn(async () => []),
        sync: vi.fn(async () => undefined),
        refresh: vi.fn(async () => undefined),
        terminate: vi.fn(async () => undefined),
        setAutomatedSync: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
    }
})

vi.mock('@/application/services/argocd/ArgoService', () => ({
    ArgoService: class {
        public listApplications = fake.listApplications

        public listProjects = fake.listProjects

        public listApplicationSets = fake.listApplicationSets

        public sync = fake.sync

        public refresh = fake.refresh

        public terminate = fake.terminate

        public setAutomatedSync = fake.setAutomatedSync

        public remove = fake.remove
    },
}))

import { ArgoApplicationEntity } from '@/domain/entities/argocd'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ArgoApplicationDeletedEvent } from '@/domain/events/argocd/ArgoApplicationDeletedEvent'
import { ArgoSyncRequestedEvent } from '@/domain/events/argocd/ArgoSyncRequestedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { ArgoCapabilities, ArgoResourceKinds, ArgoSyncDraftDefaults } from '@/domain/models/argocd'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ArgoStore } from '@/store/modules/argocd/ArgoStore'

const store = container.resolve(ArgoStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, event => void errors.push(event))

const installed = ArgoCapabilities.of([ArgoResourceKinds.applications()])

const application = (name: string, overrides: Record<string, unknown> = {}) => ArgoApplicationEntity.build({
    uid: `${name}-uid`,
    metadata: { uid: `${name}-uid`, name, namespace: 'argocd' },
    spec: { project: 'payments', source: { repoURL: 'https://git/acme/web', targetRevision: 'main' } },
    status: { sync: { status: 'Synced' }, health: { status: 'Healthy' } },
    ...overrides,
})

describe('ArgoStore', () => {
    beforeEach(() => {
        errors.splice(0, errors.length)
        fake.state.applications = []
        fake.state.failWith = null
        Object.values(fake).forEach(value => typeof value === 'function' && (value as any).mockClear?.())
        store.forget(store.clusterId)
        store.clusterId = ''
    })

    it('lists the applications when entering a cluster that serves Argo CD', async () => {
        fake.state.applications = [application('web')]

        await store.enter('prod', installed)

        expect(store.isInstalled).toBe(true)
        expect(store.applications).toHaveLength(1)
        expect(store.loaded).toBe(true)
    })

    it('asks the cluster for nothing when Argo CD is not installed', async () => {
        await store.enter('prod', ArgoCapabilities.of([]))

        expect(fake.listApplications).not.toHaveBeenCalled()
        expect(store.isInstalled).toBe(false)
    })

    it('keeps a failure on screen and reports it once, without throwing outwards', async () => {
        fake.state.failWith = new ApiError('You cannot list Applications in this cluster', 'applications.argoproj.io is forbidden')

        await store.enter('prod', installed)

        expect(store.error).toBe('You cannot list Applications in this cluster')
        expect(store.errorDetail).toBe('applications.argoproj.io is forbidden')
        expect(store.loading).toBe(false)
        expect(errors).toHaveLength(1)
    })

    it('holds the filters without narrowing the collection it loaded', async () => {
        fake.state.applications = [application('web'), application('api')]
        await store.enter('prod', installed)

        store.setSearch('web')
        store.setSyncFilter('OutOfSync')

        expect(store.applications).toHaveLength(2)
        expect(store.hasFilters).toBe(true)
    })

    it('clears every filter at once', async () => {
        await store.enter('prod', installed)
        store.setSearch('web')
        store.setHealthFilter('Degraded')

        store.clearFilters()

        expect(store.hasFilters).toBe(false)
    })

    it('syncs the application, announces it and relists', async () => {
        fake.state.applications = [application('web')]
        await store.enter('prod', installed)
        const events: ArgoSyncRequestedEvent[] = []
        const onSynced = (event: ArgoSyncRequestedEvent) => void events.push(event)
        eventBus.registerHandler(ArgoSyncRequestedEvent, onSynced)
        fake.listApplications.mockClear()

        await store.sync(store.applications[0], ArgoSyncDraftDefaults.blank())

        expect(fake.sync).toHaveBeenCalledTimes(1)
        expect(fake.listApplications).toHaveBeenCalledTimes(1)
        expect(events[0].name).toBe('web')
        eventBus.unregisterHandler(ArgoSyncRequestedEvent, onSynced)
    })

    // Argo CD replays the source a revision was deployed from, so a rollback has to hand it over.
    it('hands the historical source over when rolling back to a revision', async () => {
        const source = { repoURL: 'https://git/acme/web', path: 'deploy', targetRevision: 'v1.0.0' }
        fake.state.applications = [application('web', {
            status: {
                sync: { status: 'Synced' },
                health: { status: 'Healthy' },
                history: [{ id: 1, revision: 'old123', source }],
            },
        })]
        await store.enter('prod', installed)

        await store.sync(store.applications[0], ArgoSyncDraftDefaults.atRevision('old123'))

        expect(fake.sync).toHaveBeenCalledWith(expect.anything(), expect.anything(), source)
    })

    it('marks the row busy while an action runs and clears it afterwards', async () => {
        fake.state.applications = [application('web')]
        await store.enter('prod', installed)
        const key = store.keyOf(store.applications[0])
        let seen: string[] = []
        fake.refresh.mockImplementationOnce(async () => {
            seen = [...store.busyKeys]
        })

        await store.refresh(store.applications[0], false)

        expect(seen).toEqual([key])
        expect(store.busyKeys).toEqual([])
    })

    it('reports a failed action without leaving the row busy', async () => {
        fake.state.applications = [application('web')]
        await store.enter('prod', installed)
        fake.refresh.mockRejectedValueOnce(new ApiError('Argo CD refused the refresh', 'forbidden'))

        await store.refresh(store.applications[0], false)

        expect(store.busyKeys).toEqual([])
        expect(errors).toHaveLength(1)
    })

    it('closes the panel and announces the delete once the application is gone', async () => {
        fake.state.applications = [application('web')]
        await store.enter('prod', installed)
        store.open(store.keyOf(store.applications[0]))
        const events: ArgoApplicationDeletedEvent[] = []
        const onDeleted = (event: ArgoApplicationDeletedEvent) => void events.push(event)
        eventBus.registerHandler(ArgoApplicationDeletedEvent, onDeleted)

        await store.remove(store.applications[0], true)

        expect(fake.remove).toHaveBeenCalledWith(expect.anything(), true, [])
        expect(store.selectedKey).toBe('')
        expect(events[0].cascade).toBe(true)
        eventBus.unregisterHandler(ArgoApplicationDeletedEvent, onDeleted)
    })

    it('forgets everything it knew when the cluster changes', async () => {
        fake.state.applications = [application('web')]
        await store.enter('prod', installed)
        store.setSearch('web')

        fake.state.applications = []
        await store.enter('staging', installed)

        expect(store.applications).toEqual([])
        expect(store.search).toBe('')
    })

    it('leaves another cluster alone when one is disconnected', async () => {
        fake.state.applications = [application('web')]
        await store.enter('prod', installed)

        store.forget('staging')

        expect(store.applications).toHaveLength(1)
    })
})
