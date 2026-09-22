import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = {
        projects: [] as unknown[],
        sets: [] as unknown[],
        failWith: null as Error | null,
    }

    return {
        state,
        listApplications: vi.fn(async () => []),
        listProjects: vi.fn(async () => {
            if (state.failWith) {
                throw state.failWith
            }
            return state.projects
        }),
        listApplicationSets: vi.fn(async () => state.sets),
    }
})

vi.mock('@/application/services/argocd/ArgoService', () => ({
    ArgoService: class {
        public listApplications = fake.listApplications

        public listProjects = fake.listProjects

        public listApplicationSets = fake.listApplicationSets
    },
}))

import { ArgoApplicationSetEntity, ArgoAppProjectEntity } from '@/domain/entities/argocd'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { ArgoCapabilities, ArgoResourceKinds } from '@/domain/models/argocd'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ArgoProjectStore } from '@/store/modules/argocd/ArgoProjectStore'

const store = container.resolve(ArgoProjectStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, event => void errors.push(event))

const everything = ArgoCapabilities.of([
    ArgoResourceKinds.applications(),
    ArgoResourceKinds.appProjects(),
    ArgoResourceKinds.applicationSets(),
])

const projectsOnly = ArgoCapabilities.of([
    ArgoResourceKinds.applications(),
    ArgoResourceKinds.appProjects(),
])

const project = (name: string) => ArgoAppProjectEntity.build({
    uid: `${name}-uid`,
    metadata: { uid: `${name}-uid`, name, namespace: 'argocd' },
    spec: { description: 'Payments team', sourceRepos: ['*'] },
})

const applicationSet = (name: string) => ArgoApplicationSetEntity.build({
    uid: `${name}-uid`,
    metadata: { uid: `${name}-uid`, name, namespace: 'argocd' },
    spec: { generators: [{ list: {} }] },
})

describe('ArgoProjectStore', () => {
    beforeEach(() => {
        errors.splice(0, errors.length)
        fake.state.projects = []
        fake.state.sets = []
        fake.state.failWith = null
        Object.values(fake).forEach(value => typeof value === 'function' && (value as any).mockClear?.())
        store.forget(store.clusterId)
        store.clusterId = ''
    })

    it('reads projects and application sets in one pass', async () => {
        fake.state.projects = [project('payments')]
        fake.state.sets = [applicationSet('teams')]

        await store.enter('prod', everything)

        expect(store.projects).toHaveLength(1)
        expect(store.applicationSets).toHaveLength(1)
        expect(store.hasApplicationSets).toBe(true)
    })

    it('does not ask for a kind the cluster does not serve', async () => {
        await store.enter('prod', projectsOnly)

        expect(fake.listProjects).toHaveBeenCalledTimes(1)
        expect(fake.listApplicationSets).not.toHaveBeenCalled()
        expect(store.hasApplicationSets).toBe(false)
    })

    it('reads the catalogs once, not on every visit to the tab', async () => {
        await store.enter('prod', everything)
        await store.enter('prod', everything)

        expect(fake.listProjects).toHaveBeenCalledTimes(1)
    })

    it('re-reads them for a different cluster', async () => {
        await store.enter('prod', everything)

        await store.enter('staging', everything)

        expect(fake.listProjects).toHaveBeenCalledTimes(2)
    })

    it('keeps a failure on screen and reports it once', async () => {
        fake.state.failWith = new ApiError('You cannot list AppProjects', 'forbidden')

        await store.enter('prod', everything)

        expect(store.error).toBe('You cannot list AppProjects')
        expect(store.loading).toBe(false)
        expect(errors).toHaveLength(1)
    })

    it('opens and closes the two panels independently', async () => {
        fake.state.projects = [project('payments')]
        fake.state.sets = [applicationSet('teams')]
        await store.enter('prod', everything)

        store.openProject('payments-uid')
        store.openSet('teams-uid')

        expect(store.selectedProject?.name).toBe('payments')
        expect(store.selectedSet?.name).toBe('teams')

        store.closeProject()

        expect(store.selectedProject).toBeNull()
        expect(store.selectedSet?.name).toBe('teams')
    })
})
