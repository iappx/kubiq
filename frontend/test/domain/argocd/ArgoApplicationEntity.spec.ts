import { describe, expect, it } from 'vitest'
import { ArgoApplicationEntity } from '@/domain/entities/argocd'

const application = (overrides: Record<string, unknown> = {}) => ArgoApplicationEntity.build({
    uid: 'app-uid',
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: { uid: 'app-uid', name: 'web', namespace: 'argocd', creationTimestamp: '2026-09-01T10:00:00Z' },
    spec: {
        project: 'payments',
        source: { repoURL: 'https://git/acme/web', path: 'deploy/overlays/prod', targetRevision: 'main' },
        destination: { server: 'https://kubernetes.default.svc', namespace: 'prod' },
    },
    status: {
        sync: { status: 'Synced', revision: 'a'.repeat(40) },
        health: { status: 'Healthy' },
    },
    ...overrides,
})

describe('ArgoApplicationEntity', () => {
    it('reads the fields an operator scans the list for', () => {
        const entity = application()

        expect(entity.name).toBe('web')
        expect(entity.namespace).toBe('argocd')
        expect(entity.project).toBe('payments')
        expect(entity.destinationNamespace).toBe('prod')
        expect(entity.destinationCluster).toBe('https://kubernetes.default.svc')
        expect(entity.syncStatus).toBe('Synced')
        expect(entity.healthStatus).toBe('Healthy')
    })

    it('falls back to the default project the way Argo CD does', () => {
        expect(application({ spec: {} }).project).toBe('default')
    })

    it('prefers the cluster name over its address when the destination carries one', () => {
        const entity = application({
            spec: { destination: { name: 'in-cluster', server: 'https://kubernetes.default.svc' } },
        })

        expect(entity.destinationCluster).toBe('in-cluster')
    })

    it('shows the chart for a Helm source and the path for a git one', () => {
        expect(application().sourceText).toBe('deploy/overlays/prod')
        expect(application({ spec: { source: { chart: 'nginx' } } }).sourceText).toBe('nginx')
    })

    it('reads the first entry of a multi-source application', () => {
        const entity = application({
            spec: { sources: [{ repoURL: 'https://git/acme/a', path: 'a' }, { repoURL: 'https://git/acme/b' }] },
        })

        expect(entity.sourceText).toBe('a')
        expect(entity.sources).toHaveLength(2)
    })

    it('treats a status Argo CD did not write as unknown, not as healthy', () => {
        const entity = application({ status: {} })

        expect(entity.syncStatus).toBe('Unknown')
        expect(entity.healthStatus).toBe('Unknown')
        expect(entity.state).toBe('unknown')
    })

    it('calls a degraded application an error and an out-of-sync one a warning', () => {
        const degraded = application({
            status: { sync: { status: 'Synced' }, health: { status: 'Degraded' } },
        })
        const drifted = application({
            status: { sync: { status: 'OutOfSync' }, health: { status: 'Healthy' } },
        })

        expect(degraded.state).toBe('error')
        expect(drifted.state).toBe('warning')
    })

    it('reads a running operation as pending even while the health is still Healthy', () => {
        const entity = application({
            status: {
                sync: { status: 'Synced' },
                health: { status: 'Healthy' },
                operationState: { phase: 'Running' },
            },
        })

        expect(entity.isOperationRunning).toBe(true)
        expect(entity.state).toBe('pending')
    })

    it('reads an object on its way out as pending, whatever its health says', () => {
        const entity = application({
            metadata: { uid: 'app-uid', name: 'web', deletionTimestamp: '2026-09-02T10:00:00Z' },
            status: { health: { status: 'Degraded' } },
        })

        expect(entity.state).toBe('pending')
    })

    it('spells out the sync policy the way the list column shows it', () => {
        expect(application().syncPolicyText).toBe('Manual')
        expect(application({ spec: { syncPolicy: { automated: {} } } }).syncPolicyText).toBe('Automated')
        expect(application({
            spec: { syncPolicy: { automated: { prune: true, selfHeal: true } } },
        }).syncPolicyText).toBe('Automated (prune, self-heal)')
    })

    it('reads an automated policy that was erased as manual again', () => {
        expect(application({ spec: { syncPolicy: { automated: null } } }).isAutoSync).toBe(false)
    })

    it('answers with empty collections where the controller has written nothing', () => {
        const entity = application({ status: {} })

        expect(entity.conditions).toEqual([])
        expect(entity.resources).toEqual([])
        expect(entity.history).toEqual([])
    })

    it('carries the operation field the controller reads a sync request from', () => {
        const entity = application()
        entity.setDataValue('operation', { sync: { prune: true } })

        expect(entity.getDataValues().operation).toEqual({ sync: { prune: true } })
    })
})
