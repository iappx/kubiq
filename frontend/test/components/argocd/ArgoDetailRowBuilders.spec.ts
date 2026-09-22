import { describe, expect, it } from 'vitest'
import { ArgoHistoryRowBuilder } from '@/components/argocd/detail/ArgoHistoryRowBuilder'
import { ArgoResourceRowBuilder } from '@/components/argocd/detail/ArgoResourceRowBuilder'

describe('ArgoResourceRowBuilder', () => {
    it('rebuilds the apiVersion out of the group and version Argo CD reports separately', () => {
        expect(ArgoResourceRowBuilder.apiVersionOf({ group: 'apps', version: 'v1' })).toBe('apps/v1')
        expect(ArgoResourceRowBuilder.apiVersionOf({ version: 'v1' })).toBe('v1')
    })

    it('reads the name, kind and both statuses of a managed object', () => {
        const row = ArgoResourceRowBuilder.row({
            group: 'apps',
            version: 'v1',
            kind: 'Deployment',
            namespace: 'prod',
            name: 'web',
            status: 'OutOfSync',
            health: { status: 'Degraded', message: 'ReplicaSet has 0 ready' },
        })

        expect(row).toMatchObject({
            kind: 'Deployment',
            apiVersion: 'apps/v1',
            namespace: 'prod',
            name: 'web',
            syncText: 'Out of sync',
            healthText: 'Degraded',
            healthMessage: 'ReplicaSet has 0 ready',
            tone: 'error',
        })
    })

    // Argo CD reports no health for objects it has no check for, so sync alone has to carry the tone.
    it('falls back to the sync status for an object with no health', () => {
        const row = ArgoResourceRowBuilder.row({ version: 'v1', kind: 'ConfigMap', name: 'settings', status: 'Synced' })

        expect(row.healthText).toBe('')
        expect(row.tone).toBe('ok')
    })

    it('flags an object the next sync would prune', () => {
        const row = ArgoResourceRowBuilder.row({ kind: 'Service', name: 'old', requiresPruning: true })

        expect(row.requiresPruning).toBe(true)
    })

    it('keys rows apart when two kinds share a name', () => {
        const rows = ArgoResourceRowBuilder.build([
            { version: 'v1', kind: 'Service', namespace: 'prod', name: 'web' },
            { group: 'apps', version: 'v1', kind: 'Deployment', namespace: 'prod', name: 'web' },
        ])

        expect(new Set(rows.map(row => row.key)).size).toBe(2)
    })
})

describe('ArgoHistoryRowBuilder', () => {
    const history = [
        { id: 1, revision: 'a'.repeat(40), deployedAt: '2026-08-01T10:00:00Z', source: { path: 'deploy' } },
        { id: 3, revision: 'c'.repeat(40), deployedAt: '2026-09-01T10:00:00Z', source: { chart: 'nginx' } },
        { id: 2, revision: 'b'.repeat(40), deployedAt: '2026-08-15T10:00:00Z' },
    ]

    it('puts the newest deployment first', () => {
        expect(ArgoHistoryRowBuilder.build(history, '').map(row => row.id)).toEqual([3, 2, 1])
    })

    it('abbreviates a commit for the row and keeps the whole one for the action', () => {
        const [row] = ArgoHistoryRowBuilder.build(history, '')

        expect(row.shortRevision).toBe('ccccccc')
        expect(row.revision).toBe('c'.repeat(40))
    })

    it('marks the revision the application is running now', () => {
        const rows = ArgoHistoryRowBuilder.build(history, 'b'.repeat(40))

        expect(rows.filter(row => row.isCurrent).map(row => row.id)).toEqual([2])
    })

    it('never marks an entry current when the application has no synced revision', () => {
        expect(ArgoHistoryRowBuilder.build(history, '').some(row => row.isCurrent)).toBe(false)
    })

    it('shows the chart for a Helm source and the path for a git one', () => {
        const rows = ArgoHistoryRowBuilder.build(history, '')

        expect(rows[0].source).toBe('nginx')
        expect(rows[2].source).toBe('deploy')
        expect(rows[1].source).toBe('')
    })
})
