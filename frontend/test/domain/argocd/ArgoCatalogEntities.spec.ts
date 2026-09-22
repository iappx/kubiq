import { describe, expect, it } from 'vitest'
import {
    ArgoApplicationSetEntity,
    ArgoAppProjectEntity,
    ArgoHealthStatusCatalog,
    ArgoOperationPhaseCatalog,
    ArgoSyncStatusCatalog,
} from '@/domain/entities/argocd'

describe('ArgoSyncStatusCatalog', () => {
    it('spells OutOfSync as two words for a human', () => {
        expect(ArgoSyncStatusCatalog.title('OutOfSync')).toBe('Out of sync')
    })

    it('reads an unknown value as Unknown rather than trusting it', () => {
        expect(ArgoSyncStatusCatalog.read('Whatever')).toBe('Unknown')
        expect(ArgoSyncStatusCatalog.read(undefined)).toBe('Unknown')
        expect(ArgoSyncStatusCatalog.read('Synced')).toBe('Synced')
    })

    it('lists every status the filter offers', () => {
        expect(ArgoSyncStatusCatalog.all()).toEqual(['Synced', 'OutOfSync', 'Unknown'])
    })
})

describe('ArgoHealthStatusCatalog', () => {
    it('covers the six states Argo CD reports', () => {
        expect(ArgoHealthStatusCatalog.all()).toHaveLength(6)
        expect(ArgoHealthStatusCatalog.has('Suspended')).toBe(true)
    })

    it('reads an unrecognised health as Unknown', () => {
        expect(ArgoHealthStatusCatalog.read('Broken')).toBe('Unknown')
    })
})

describe('ArgoOperationPhaseCatalog', () => {
    it('treats Running and Terminating as an operation still in flight', () => {
        expect(ArgoOperationPhaseCatalog.isLive('Running')).toBe(true)
        expect(ArgoOperationPhaseCatalog.isLive('Terminating')).toBe(true)
        expect(ArgoOperationPhaseCatalog.isLive('Succeeded')).toBe(false)
        expect(ArgoOperationPhaseCatalog.isLive(undefined)).toBe(false)
    })

    it('separates a failure from a phase it does not recognise', () => {
        expect(ArgoOperationPhaseCatalog.isFailure('Error')).toBe(true)
        expect(ArgoOperationPhaseCatalog.read('Nonsense')).toBeUndefined()
    })
})

describe('ArgoAppProjectEntity', () => {
    const project = (spec: Record<string, unknown>) => ArgoAppProjectEntity.build({
        uid: 'project-uid',
        metadata: { uid: 'project-uid', name: 'payments', namespace: 'argocd' },
        spec,
    })

    it('reads a wildcard source list as Any rather than an asterisk', () => {
        expect(project({ sourceRepos: ['*'] }).sourceReposText).toBe('Any')
    })

    it('joins the repositories it is allowed to pull from', () => {
        expect(project({ sourceRepos: ['https://git/a', 'https://git/b'] }).sourceReposText)
            .toBe('https://git/a, https://git/b')
    })

    it('describes a destination as cluster and namespace', () => {
        const entity = project({
            destinations: [{ name: 'in-cluster', namespace: 'prod' }, { server: 'https://other', namespace: '*' }],
        })

        expect(entity.destinationsText).toBe('in-cluster/prod, https://other/*')
    })

    it('answers with empty lists for a project that declares nothing', () => {
        expect(project({}).sourceRepos).toEqual([])
        expect(project({}).destinations).toEqual([])
    })
})

describe('ArgoApplicationSetEntity', () => {
    const set = (overrides: Record<string, unknown> = {}) => ArgoApplicationSetEntity.build({
        uid: 'set-uid',
        metadata: { uid: 'set-uid', name: 'teams', namespace: 'argocd' },
        spec: {
            generators: [{ list: {} }, { git: {} }],
            template: { spec: { project: 'payments' } },
        },
        ...overrides,
    })

    it('names the generators it is built from', () => {
        expect(set().generatorKinds).toEqual(['list', 'git'])
        expect(set().generatorsText).toBe('list, git')
    })

    it('reads the project off the template it stamps out', () => {
        expect(set().project).toBe('payments')
    })

    it('defaults the strategy to the one Argo CD applies when none is declared', () => {
        expect(set().strategy).toBe('AllAtOnce')
    })

    it('is an error once the controller says one occurred', () => {
        const failing = set({ status: { conditions: [{ type: 'ErrorOccurred', status: 'True' }] } })

        expect(failing.state).toBe('error')
        expect(failing.isProblematic).toBe(true)
    })

    it('is unknown while the controller has said nothing at all', () => {
        expect(set().state).toBe('unknown')
    })

    it('is healthy once the controller reported without an error', () => {
        expect(set({ status: { conditions: [{ type: 'ErrorOccurred', status: 'False' }] } }).state).toBe('ok')
    })
})
