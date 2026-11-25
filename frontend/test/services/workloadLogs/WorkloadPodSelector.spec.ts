import { describe, expect, it } from 'vitest'
import { WorkloadPodSelector } from '@/application/services/workloadLogs/models/WorkloadPodSelector'
import { PodEntity } from '@/domain/entities/workloads'
import { KubeResourceRegistry } from '@/domain/models/kube'

const kind = (group: string, resource: string) => KubeResourceRegistry.find(group, resource)!

const pod = (name: string, phase: string, createdAt: string): PodEntity => PodEntity.build({
    uid: `uid-${name}`,
    metadata: { uid: `uid-${name}`, name, namespace: 'payments', creationTimestamp: createdAt },
    spec: { containers: [{ name: 'app' }] },
    status: { phase },
})

describe('WorkloadPodSelector', () => {
    it('formats spec.selector.matchLabels into a comma-separated label selector', () => {
        const selector = WorkloadPodSelector.labelSelectorFor(kind('apps', 'deployments'), {
            metadata: { name: 'api' },
            spec: {
                selector: {
                    matchLabels: {
                        app: 'api',
                        tier: 'backend',
                    },
                },
            },
        })

        expect(selector).toBe('app=api,tier=backend')
    })

    it('falls back to job-name for a Job without matchLabels', () => {
        const selector = WorkloadPodSelector.labelSelectorFor(kind('batch', 'jobs'), {
            metadata: { name: 'nightly-report' },
            spec: {},
        })

        expect(selector).toBe('job-name=nightly-report')
    })

    it('returns an empty selector when a non-Job workload has no matchLabels', () => {
        expect(WorkloadPodSelector.labelSelectorFor(kind('apps', 'deployments'), {
            metadata: { name: 'api' },
            spec: {},
        })).toBe('')
    })

    it('formats spec.selector.matchExpressions for In, NotIn, Exists and DoesNotExist', () => {
        const selector = WorkloadPodSelector.labelSelectorFor(kind('apps', 'deployments'), {
            metadata: { name: 'api' },
            spec: {
                selector: {
                    matchExpressions: [
                        { key: 'env', operator: 'In', values: ['prod', 'staging'] },
                        { key: 'tier', operator: 'NotIn', values: ['canary', 'dev'] },
                        { key: 'app', operator: 'Exists' },
                        { key: 'deprecated', operator: 'DoesNotExist' },
                    ],
                },
            },
        })

        expect(selector).toBe('env in (prod,staging),tier notin (canary,dev),app,!deprecated')
    })

    it('combines matchLabels and matchExpressions into a single comma-separated selector', () => {
        const selector = WorkloadPodSelector.labelSelectorFor(kind('apps', 'statefulsets'), {
            metadata: { name: 'db' },
            spec: {
                selector: {
                    matchLabels: { app: 'db' },
                    matchExpressions: [
                        { key: 'role', operator: 'In', values: ['primary', 'replica'] },
                        { key: 'maintenance', operator: 'DoesNotExist' },
                    ],
                },
            },
        })

        expect(selector).toBe('app=db,role in (primary,replica),!maintenance')
    })

    it('skips malformed matchExpressions entries while preserving valid ones', () => {
        const selector = WorkloadPodSelector.labelSelectorFor(kind('apps', 'deployments'), {
            metadata: { name: 'api' },
            spec: {
                selector: {
                    matchExpressions: [
                        null,
                        { operator: 'Exists' },
                        { key: '', operator: 'Exists' },
                        { key: 'env', operator: 'In' },
                        { key: 'env', operator: 'In', values: [] },
                        { key: 'env', operator: 'In', values: [123, ''] },
                        { key: 'env', operator: 'NotIn', values: 'prod' },
                        { key: 'env', operator: 'Unknown', values: ['prod'] },
                        { key: 'app', operator: 'Exists' },
                    ],
                },
            },
        })

        expect(selector).toBe('app')
    })

    it('falls back to job-name for a Job when matchExpressions has only malformed entries', () => {
        const selector = WorkloadPodSelector.labelSelectorFor(kind('batch', 'jobs'), {
            metadata: { name: 'cleanup-job' },
            spec: {
                selector: {
                    matchExpressions: [
                        { key: 'env', operator: 'In', values: [] },
                    ],
                },
            },
        })

        expect(selector).toBe('job-name=cleanup-job')
    })

    it('uses valid matchExpressions on a Job instead of falling back to job-name', () => {
        const selector = WorkloadPodSelector.labelSelectorFor(kind('batch', 'jobs'), {
            metadata: { name: 'cleanup-job' },
            spec: {
                selector: {
                    matchExpressions: [
                        { key: 'controller-uid', operator: 'In', values: ['uid-1'] },
                    ],
                },
            },
        })

        expect(selector).toBe('controller-uid in (uid-1)')
    })

    it('sorts Running pods first, then newest createdAt, then name ascending', () => {
        const sorted = WorkloadPodSelector.sortPods([
            pod('api-old-running', 'Running', '2026-10-01T08:00:00Z'),
            pod('api-failed-newest', 'Failed', '2026-10-01T12:00:00Z'),
            pod('api-b-new-running', 'Running', '2026-10-01T11:00:00Z'),
            pod('api-a-new-running', 'Running', '2026-10-01T11:00:00Z'),
            pod('api-pending', 'Pending', '2026-10-01T09:00:00Z'),
        ])

        expect(sorted.map(item => item.name)).toEqual([
            'api-a-new-running',
            'api-b-new-running',
            'api-old-running',
            'api-failed-newest',
            'api-pending',
        ])
    })
})
