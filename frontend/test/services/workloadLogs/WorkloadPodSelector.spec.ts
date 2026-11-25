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
