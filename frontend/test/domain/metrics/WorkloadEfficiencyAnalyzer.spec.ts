import { describe, expect, it } from 'vitest'
import { NodeEntity } from '@/domain/entities/cluster'
import { PodEntity } from '@/domain/entities/workloads'
import { WorkloadEfficiencyAnalyzer } from '@/domain/models/metrics'
import type { TPodUsage } from '@/domain/models/metrics'

const buildNode = (
    name: string,
    capacity: Record<string, string>,
    allocatable: Record<string, string>,
): NodeEntity => NodeEntity.build({
    uid: name,
    metadata: { name },
    status: { capacity, allocatable },
})

const buildPod = (
    namespace: string,
    name: string,
    phase: 'Running' | 'Pending' | 'Succeeded' | 'Failed',
    containers: Array<{
        name: string
        requests?: Record<string, string>
        limits?: Record<string, string>
    }>,
    initContainers?: Array<{ name: string; requests?: Record<string, string> }>,
): PodEntity => PodEntity.build({
    uid: `${namespace}/${name}`,
    metadata: { name, namespace },
    spec: {
        containers: containers.map(container => ({
            name: container.name,
            resources: { requests: container.requests, limits: container.limits },
        })),
        initContainers: initContainers?.map(container => ({
            name: container.name,
            resources: { requests: container.requests },
        })),
    },
    status: { phase },
})

const mib = (value: number): number => value * 1024 * 1024

describe('WorkloadEfficiencyAnalyzer', () => {
    it('summarizes node capacity, allocatable resources and active pod requests', () => {
        const nodes = [
            buildNode('node-a', { cpu: '4', memory: '16Gi', pods: '110' }, { cpu: '3800m', memory: '14Gi', pods: '110' }),
            buildNode('node-b', { cpu: '8', memory: '32Gi', pods: '110' }, { cpu: '7600m', memory: '28Gi', pods: '110' }),
        ]
        const pods = [
            buildPod('prod', 'api-0', 'Running', [
                { name: 'app', requests: { cpu: '500m', memory: '512Mi' } },
                { name: 'proxy', requests: { cpu: '100m', memory: '128Mi' } },
            ]),
            buildPod('prod', 'init-heavy', 'Pending', [
                { name: 'app', requests: { cpu: '200m', memory: '256Mi' } },
            ], [
                { name: 'migrate', requests: { cpu: '1', memory: '1Gi' } },
            ]),
            buildPod('prod', 'done-job', 'Succeeded', [
                { name: 'job', requests: { cpu: '2', memory: '4Gi' } },
            ]),
            buildPod('prod', 'dead-job', 'Failed', [
                { name: 'job', requests: { cpu: '2', memory: '4Gi' } },
            ]),
        ]

        const summary = WorkloadEfficiencyAnalyzer.summarizeCapacity(nodes, pods)

        expect(summary.nodeCount).toBe(2)
        expect(summary.cpuCapacityCores).toBeCloseTo(12)
        expect(summary.memoryCapacityBytes).toBe(48 * 1024 ** 3)
        expect(summary.cpuAllocatableCores).toBeCloseTo(11.4)
        expect(summary.memoryAllocatableBytes).toBe(42 * 1024 ** 3)
        expect(summary.podsAllocatable).toBe(220)
        expect(summary.podsAllocated).toBe(2)
        expect(summary.cpuRequestedCores).toBeCloseTo(1.6)
        expect(summary.memoryRequestedBytes).toBe(mib(640) + 1024 ** 3)
    })

    it('detects over-request pods, groups by namespace and sorts by worst ratio descending', () => {
        const pods = [
            buildPod('payments', 'checkout-0', 'Running', [
                { name: 'app', requests: { cpu: '100m', memory: '256Mi' }, limits: { cpu: '500m', memory: '1Gi' } },
            ]),
            buildPod('search', 'indexer-0', 'Running', [
                { name: 'indexer', requests: { cpu: '200m', memory: '512Mi' }, limits: { cpu: '1', memory: '2Gi' } },
            ]),
            buildPod('search', 'healthy-0', 'Running', [
                { name: 'api', requests: { cpu: '500m', memory: '512Mi' } },
            ]),
            buildPod('search', 'completed-0', 'Succeeded', [
                { name: 'job', requests: { cpu: '100m', memory: '128Mi' } },
            ]),
        ]
        const usage: Record<string, TPodUsage> = {
            'payments/checkout-0': { cpuCores: 0.184, memoryBytes: mib(200) },
            'search/indexer-0': { cpuCores: 0.608, memoryBytes: mib(500) },
            'search/healthy-0': { cpuCores: 0.25, memoryBytes: mib(256) },
            'search/completed-0': { cpuCores: 0.5, memoryBytes: mib(512) },
        }

        const groups = WorkloadEfficiencyAnalyzer.analyze(pods, usage, 'over-request', 150)

        expect(groups.map(group => group.namespace)).toEqual(['search', 'payments'])
        expect(groups[0].podCount).toBe(1)
        expect(groups[0].maxCpuRatio).toBeCloseTo(3.04)
        expect(groups[0].items[0]).toMatchObject({
            podName: 'indexer-0',
            containerName: 'indexer',
        })
        expect(groups[1].maxCpuRatio).toBeCloseTo(1.84)
    })

    it('detects near-limit containers using per-container usage when present', () => {
        const pods = [
            buildPod('media', 'worker-0', 'Running', [
                { name: 'encoder', requests: { cpu: '500m', memory: '512Mi' }, limits: { cpu: '1', memory: '1Gi' } },
                { name: 'sidecar', requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '200m', memory: '256Mi' } },
            ]),
        ]
        const usage: Record<string, TPodUsage> = {
            'media/worker-0': {
                cpuCores: 0.95,
                memoryBytes: mib(950),
                containers: {
                    encoder: { cpuCores: 0.9, memoryBytes: mib(900) },
                    sidecar: { cpuCores: 0.05, memoryBytes: mib(50) },
                },
            },
        }

        const groups = WorkloadEfficiencyAnalyzer.analyze(pods, usage, 'near-limit', 80)

        expect(groups).toHaveLength(1)
        expect(groups[0].items).toHaveLength(1)
        expect(groups[0].items[0].containerName).toBe('encoder')
        expect(groups[0].items[0].cpuRatio).toBeCloseTo(0.9)
    })

    it('detects unused-requests pods at or below the threshold and sorts lowest utilization first', () => {
        const pods = [
            buildPod('batch', 'moderate-0', 'Running', [
                { name: 'worker', requests: { cpu: '1', memory: '1Gi' } },
            ]),
            buildPod('batch', 'idle-0', 'Running', [
                { name: 'worker', requests: { cpu: '1', memory: '1Gi' } },
            ]),
            buildPod('batch', 'cpu-only-0', 'Running', [
                { name: 'worker', requests: { cpu: '1' } },
            ]),
            buildPod('batch', 'busy-0', 'Running', [
                { name: 'worker', requests: { cpu: '1', memory: '1Gi' } },
            ]),
            buildPod('analytics', 'barely-used-0', 'Running', [
                { name: 'worker', requests: { cpu: '1', memory: '1Gi' } },
            ]),
        ]
        const usage: Record<string, TPodUsage> = {
            'batch/moderate-0': { cpuCores: 0.2, memoryBytes: mib(256) },
            'batch/idle-0': { cpuCores: 0.08, memoryBytes: mib(512) },
            'batch/cpu-only-0': { cpuCores: 0.15, memoryBytes: mib(512) },
            'batch/busy-0': { cpuCores: 0.8, memoryBytes: mib(800) },
            'analytics/barely-used-0': { cpuCores: 0.02, memoryBytes: mib(64) },
        }

        const groups = WorkloadEfficiencyAnalyzer.analyze(pods, usage, 'unused-requests', 25)

        expect(groups.map(group => group.namespace)).toEqual(['analytics', 'batch'])
        expect(groups[0].items.map(item => item.podName)).toEqual(['barely-used-0'])
        expect(groups[1].items.map(item => item.podName)).toEqual(['idle-0', 'cpu-only-0', 'moderate-0'])
    })

    it('keeps near-limit sorting descending by highest ratio within and across groups', () => {
        const pods = [
            buildPod('alpha', 'mid-0', 'Running', [
                { name: 'app', limits: { cpu: '1', memory: '1Gi' } },
            ]),
            buildPod('beta', 'high-0', 'Running', [
                { name: 'app', limits: { cpu: '1', memory: '1Gi' } },
            ]),
            buildPod('beta', 'peak-0', 'Running', [
                { name: 'app', limits: { cpu: '1', memory: '1Gi' } },
            ]),
        ]
        const usage: Record<string, TPodUsage> = {
            'alpha/mid-0': { cpuCores: 0.85, memoryBytes: mib(512) },
            'beta/high-0': { cpuCores: 0.82, memoryBytes: mib(512) },
            'beta/peak-0': { cpuCores: 0.96, memoryBytes: mib(512) },
        }

        const groups = WorkloadEfficiencyAnalyzer.analyze(pods, usage, 'near-limit', 80)

        expect(groups.map(group => group.namespace)).toEqual(['beta', 'alpha'])
        expect(groups[0].items.map(item => item.podName)).toEqual(['peak-0', 'high-0'])
    })

    it('aggregates multi-container pods when only pod-level usage is available', () => {
        const pods = [
            buildPod('edge', 'gateway-0', 'Running', [
                { name: 'app', requests: { cpu: '300m', memory: '256Mi' } },
                { name: 'envoy', requests: { cpu: '200m', memory: '256Mi' } },
            ]),
        ]
        const usage: Record<string, TPodUsage> = {
            'edge/gateway-0': { cpuCores: 1.0, memoryBytes: mib(400) },
        }

        const groups = WorkloadEfficiencyAnalyzer.analyze(pods, usage, 'over-request', 150)

        expect(groups).toHaveLength(1)
        expect(groups[0].podCount).toBe(1)
        expect(groups[0].items[0].containerName).toBe('')
        expect(groups[0].items[0].cpuRatio).toBeCloseTo(2.0)
    })
})
