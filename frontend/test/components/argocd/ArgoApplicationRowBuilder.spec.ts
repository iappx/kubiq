import { describe, expect, it } from 'vitest'
import { ArgoApplicationRowBuilder } from '@/components/argocd/ArgoApplicationRowBuilder'
import { ArgoApplicationEntity } from '@/domain/entities/argocd'

const application = (overrides: Record<string, unknown> = {}) => ArgoApplicationEntity.build({
    uid: 'app-uid',
    metadata: { uid: 'app-uid', name: 'web', namespace: 'argocd', creationTimestamp: '2026-09-01T10:00:00Z' },
    spec: {
        project: 'payments',
        source: { repoURL: 'https://git/acme/web', path: 'deploy', targetRevision: 'main' },
        destination: { server: 'https://kubernetes.default.svc', namespace: 'prod' },
        syncPolicy: { automated: { prune: true } },
    },
    status: {
        sync: { status: 'OutOfSync' },
        health: { status: 'Progressing' },
        resources: [{ kind: 'Deployment', name: 'web' }, { kind: 'Service', name: 'web' }],
        operationState: { phase: 'Running' },
    },
    ...overrides,
})

describe('ArgoApplicationRowBuilder', () => {
    it('keys a row by the object uid so the table survives a relist', () => {
        expect(ArgoApplicationRowBuilder.row(application()).key).toBe('app-uid')
    })

    it('reads the columns an operator scans', () => {
        const row = ArgoApplicationRowBuilder.row(application())

        expect(row).toMatchObject({
            name: 'web',
            namespace: 'argocd',
            project: 'payments',
            destinationNamespace: 'prod',
            sourceText: 'deploy',
            targetRevision: 'main',
            resourceCount: 2,
            createdAt: '2026-09-01T10:00:00Z',
        })
    })

    it('carries both the machine status and the word beside it', () => {
        const row = ArgoApplicationRowBuilder.row(application())

        expect(row.syncStatus).toBe('OutOfSync')
        expect(row.syncText).toBe('Out of sync')
        expect(row.healthStatus).toBe('Progressing')
        expect(row.healthText).toBe('Progressing')
    })

    it('flags a running operation so the row can say it is working', () => {
        const row = ArgoApplicationRowBuilder.row(application())

        expect(row.isOperationRunning).toBe(true)
        expect(row.operationPhase).toBe('Running')
    })

    it('spells the sync policy out for the column', () => {
        expect(ArgoApplicationRowBuilder.row(application()).syncPolicyText).toBe('Automated (prune)')
    })

    it('builds one row per application', () => {
        expect(ArgoApplicationRowBuilder.build([application(), application()])).toHaveLength(2)
    })
})
