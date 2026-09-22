import { describe, expect, it } from 'vitest'
import { ArgoApplicationFilter } from '@/components/argocd/ArgoApplicationFilter'
import { ArgoStatusOptions } from '@/components/argocd/ArgoStatusOptions'
import type { TArgoApplicationRow } from '@/components/argocd/types/TArgoApplicationRow'

const row = (overrides: Partial<TArgoApplicationRow> = {}): TArgoApplicationRow => ({
    key: 'app-uid',
    name: 'web',
    namespace: 'argocd',
    project: 'payments',
    destination: 'in-cluster',
    destinationNamespace: 'prod',
    repoUrl: 'https://git/acme/web',
    sourceText: 'deploy',
    targetRevision: 'main',
    syncStatus: 'Synced',
    syncText: 'Synced',
    healthStatus: 'Healthy',
    healthText: 'Healthy',
    syncPolicyText: 'Manual',
    isOperationRunning: false,
    resourceCount: 2,
    createdAt: '2026-09-01T10:00:00Z',
    ...overrides,
})

const rows = [
    row({ key: '1', name: 'web', syncStatus: 'Synced', healthStatus: 'Healthy' }),
    row({ key: '2', name: 'api', syncStatus: 'OutOfSync', healthStatus: 'Degraded', project: 'billing' }),
    row({ key: '3', name: 'worker', syncStatus: 'OutOfSync', healthStatus: 'Healthy', destinationNamespace: 'staging' }),
]

describe('ArgoApplicationFilter', () => {
    it('keeps everything when nothing is asked for', () => {
        expect(ArgoApplicationFilter.apply(rows, '', '', '')).toHaveLength(3)
    })

    it('matches a name regardless of case', () => {
        expect(ArgoApplicationFilter.apply(rows, 'WEB', '', '').map(match => match.key)).toEqual(['1'])
    })

    it('searches the project and the destination as well as the name', () => {
        expect(ArgoApplicationFilter.apply(rows, 'billing', '', '').map(match => match.key)).toEqual(['2'])
        expect(ArgoApplicationFilter.apply(rows, 'staging', '', '').map(match => match.key)).toEqual(['3'])
    })

    it('narrows by sync status', () => {
        expect(ArgoApplicationFilter.apply(rows, '', 'OutOfSync', '').map(match => match.key)).toEqual(['2', '3'])
    })

    it('narrows by health status', () => {
        expect(ArgoApplicationFilter.apply(rows, '', '', 'Degraded').map(match => match.key)).toEqual(['2'])
    })

    it('applies the text and both statuses together', () => {
        expect(ArgoApplicationFilter.apply(rows, 'worker', 'OutOfSync', 'Healthy').map(match => match.key))
            .toEqual(['3'])
    })

    it('ignores surrounding whitespace in the query', () => {
        expect(ArgoApplicationFilter.apply(rows, '  api  ', '', '')).toHaveLength(1)
    })
})

describe('ArgoStatusOptions', () => {
    it('counts how many applications are in each sync status', () => {
        const options = ArgoStatusOptions.sync(rows)

        expect(options.find(option => option.key === 'OutOfSync')?.count).toBe(2)
        expect(options.find(option => option.key === 'Unknown')?.count).toBe(0)
    })

    it('gives each health status the tone the table uses for it', () => {
        const options = ArgoStatusOptions.health(rows)

        expect(options.find(option => option.key === 'Degraded')?.tone).toBe('error')
        expect(options.find(option => option.key === 'Healthy')?.tone).toBe('ok')
    })

    it('offers every status the catalog knows, so a filter can be cleared to any of them', () => {
        expect(ArgoStatusOptions.health(rows)).toHaveLength(6)
        expect(ArgoStatusOptions.sync(rows)).toHaveLength(3)
    })
})
