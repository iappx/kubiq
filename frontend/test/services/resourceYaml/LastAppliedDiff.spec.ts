import { describe, expect, it } from 'vitest'
import { LastAppliedDiff } from '@/application/services/resourceYaml/models/LastAppliedDiff'

describe('LastAppliedDiff', () => {
    it('reports a clean match after stripping volatile cluster-managed fields', () => {
        const lastApplied = {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: {
                name: 'payments-api',
                namespace: 'prod',
            },
            spec: {
                replicas: 3,
                template: {
                    spec: {
                        containers: [{ name: 'api', image: 'ghcr.io/acme/api:1.2.0' }],
                    },
                },
            },
        }

        const currentObject: Record<string, unknown> = {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: {
                name: 'payments-api',
                namespace: 'prod',
                uid: '123e4567-e89b-12d3-a456-426614174000',
                resourceVersion: '94812',
                generation: 4,
                creationTimestamp: '2026-05-01T10:00:00Z',
                selfLink: '/apis/apps/v1/namespaces/prod/deployments/payments-api',
                managedFields: [{ manager: 'kubectl-client-side-apply', operation: 'Update' }],
                annotations: {
                    'kubectl.kubernetes.io/last-applied-configuration': JSON.stringify(lastApplied),
                },
            },
            spec: {
                replicas: 3,
                template: {
                    spec: {
                        containers: [{ name: 'api', image: 'ghcr.io/acme/api:1.2.0' }],
                    },
                },
            },
            status: {
                availableReplicas: 3,
                readyReplicas: 3,
            },
        }

        const result = LastAppliedDiff.compare(lastApplied, currentObject)

        expect(result).not.toBeNull()
        expect(result!.hasChanges).toBe(false)
        expect(result!.summary).toEqual({ added: 0, removed: 0 })
        expect(result!.appliedYaml).toBe(result!.currentYaml)
        expect(result!.currentYaml).not.toContain('managedFields')
        expect(result!.currentYaml).not.toContain('resourceVersion')
        expect(result!.currentYaml).not.toContain('last-applied-configuration')
        expect(result!.currentYaml).not.toContain('status:')
        expect((currentObject.metadata as Record<string, unknown>).uid).toBe('123e4567-e89b-12d3-a456-426614174000')
        expect(currentObject.status).toBeDefined()
    })

    it('normalizes key order recursively so identical manifests do not drift', () => {
        const lastApplied = {
            spec: {
                selector: { matchLabels: { tier: 'backend', app: 'api' } },
                replicas: 2,
            },
            metadata: {
                namespace: 'prod',
                annotations: {
                    'zeta.io/k': '2',
                    'alpha.io/k': '1',
                    'kubectl.kubernetes.io/last-applied-configuration': '{}',
                },
                name: 'api',
            },
            kind: 'Deployment',
            apiVersion: 'apps/v1',
        }

        const currentObject: Record<string, unknown> = {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: {
                name: 'api',
                namespace: 'prod',
                annotations: {
                    'alpha.io/k': '1',
                    'zeta.io/k': '2',
                    'kubectl.kubernetes.io/last-applied-configuration': '{"stale":true}',
                },
            },
            spec: {
                replicas: 2,
                selector: { matchLabels: { app: 'api', tier: 'backend' } },
            },
        }

        const result = LastAppliedDiff.compare(lastApplied, currentObject)

        expect(result).not.toBeNull()
        expect(result!.hasChanges).toBe(false)
        expect(result!.summary).toEqual({ added: 0, removed: 0 })
    })

    it('detects real spec drift between last-applied and live object', () => {
        const lastApplied = {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: { name: 'api', namespace: 'prod' },
            spec: {
                replicas: 2,
                template: {
                    spec: {
                        containers: [{ name: 'api', image: 'ghcr.io/acme/api:1.0.0' }],
                    },
                },
            },
        }

        const currentObject: Record<string, unknown> = {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: {
                name: 'api',
                namespace: 'prod',
                resourceVersion: '105',
                uid: 'abc-123',
            },
            spec: {
                replicas: 5,
                template: {
                    spec: {
                        containers: [{ name: 'api', image: 'ghcr.io/acme/api:1.1.0' }],
                    },
                },
            },
            status: { readyReplicas: 5 },
        }

        const result = LastAppliedDiff.compare(lastApplied, currentObject)

        expect(result).not.toBeNull()
        expect(result!.hasChanges).toBe(true)
        expect(result!.summary).toEqual({ added: 2, removed: 2 })
        expect(result!.lines.some(line => line.kind === 'removed' && line.text.includes('replicas: 2'))).toBe(true)
        expect(result!.lines.some(line => line.kind === 'added' && line.text.includes('replicas: 5'))).toBe(true)
        expect(result!.condensedLines.some(line => line.kind === 'added' && line.text.includes('1.1.0'))).toBe(true)
    })

    it('returns null when lastApplied is not a plain object', () => {
        const currentObject: Record<string, unknown> = { apiVersion: 'v1', kind: 'ConfigMap' }

        expect(LastAppliedDiff.compare(null, currentObject)).toBeNull()
        expect(LastAppliedDiff.compare(undefined, currentObject)).toBeNull()
        expect(LastAppliedDiff.compare('not-an-object', currentObject)).toBeNull()
        expect(LastAppliedDiff.compare(42, currentObject)).toBeNull()
        expect(LastAppliedDiff.compare(['a', 'b'], currentObject)).toBeNull()
    })
})
