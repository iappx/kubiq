import { describe, expect, it } from 'vitest'
import {
    MetricsObjectKey,
    NodeMetricsEntity,
    PodMetricsEntity,
    PrometheusSeriesEntity,
} from '@/domain/entities/metrics'
import { MetricsAllowance } from '@/domain/models/metrics'

describe('NodeMetricsEntity', () => {
    it('reads the usage metrics-server reports', () => {
        const node = NodeMetricsEntity.build({
            key: 'worker-1',
            metadata: { name: 'worker-1' },
            timestamp: '2026-09-22T00:00:00Z',
            window: '30s',
            usage: { cpu: '137m', memory: '1131Mi' },
        })

        expect(node.name).toBe('worker-1')
        expect(node.cpuCores).toBeCloseTo(0.137, 6)
        expect(node.memoryBytes).toBe(1131 * 1024 * 1024)
    })

    it('answers zero for a row with no usage at all', () => {
        const node = NodeMetricsEntity.build({ key: 'worker-1', metadata: { name: 'worker-1' } })

        expect(node.cpuCores).toBe(0)
        expect(node.memoryBytes).toBe(0)
    })
})

describe('PodMetricsEntity', () => {
    const pod = PodMetricsEntity.build({
        key: 'prod/api-1',
        metadata: { name: 'api-1', namespace: 'prod' },
        containers: [
            { name: 'api', usage: { cpu: '10m', memory: '20Mi' } },
            { name: 'sidecar', usage: { cpu: '5m', memory: '10Mi' } },
        ],
    })

    it('adds up every container of the pod', () => {
        expect(pod.namespace).toBe('prod')
        expect(pod.cpuCores).toBeCloseTo(0.015, 6)
        expect(pod.memoryBytes).toBe(30 * 1024 * 1024)
    })

    it('answers for one container by name', () => {
        expect(pod.cpuCoresOf('sidecar')).toBeCloseTo(0.005, 6)
        expect(pod.memoryBytesOf('api')).toBe(20 * 1024 * 1024)
        expect(pod.cpuCoresOf('missing')).toBe(0)
    })
})

describe('PrometheusSeriesEntity', () => {
    it('turns the sample pairs into points in milliseconds', () => {
        const series = PrometheusSeriesEntity.build({
            key: 'pod=api-1',
            metric: { pod: 'api-1' },
            values: [[1700000000, '0.5'], [1700000030, '0.75']],
        })

        expect(series.labelOf('pod')).toBe('api-1')
        expect(series.labelOf('container')).toBe('')
        expect(series.points).toEqual([
            { at: 1700000000000, value: 0.5 },
            { at: 1700000030000, value: 0.75 },
        ])
    })

    it('drops a sample Prometheus could not put a number on', () => {
        const series = PrometheusSeriesEntity.build({
            key: 'x',
            metric: {},
            values: [[1700000000, 'NaN'], [1700000030, '1']],
        })

        expect(series.points).toEqual([{ at: 1700000030000, value: 1 }])
    })
})

describe('MetricsObjectKey', () => {
    it('keys a namespaced object apart from a cluster-wide one', () => {
        expect(MetricsObjectKey.of('prod', 'api-1')).toBe('prod/api-1')
        expect(MetricsObjectKey.of('', 'worker-1')).toBe('worker-1')
    })
})

describe('MetricsAllowance', () => {
    it('adds up the requests and limits of the regular containers', () => {
        const allowance = MetricsAllowance.ofPod({
            spec: {
                containers: [
                    { resources: { requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '500m' } } },
                    { resources: { requests: { cpu: '50m' } } },
                ],
            },
        })

        expect(allowance.cpu.request).toBeCloseTo(0.15, 6)
        expect(allowance.cpu.limit).toBeCloseTo(0.5, 6)
        expect(allowance.memory.request).toBe(128 * 1024 * 1024)
        expect(allowance.memory.limit).toBe(0)
    })

    it('leaves init containers out, because Kubernetes takes the larger of the two', () => {
        const allowance = MetricsAllowance.ofPod({
            spec: {
                containers: [{ resources: { requests: { cpu: '100m' } } }],
                initContainers: [{ resources: { requests: { cpu: '900m' } } }],
            },
        })

        expect(allowance.cpu.request).toBeCloseTo(0.1, 6)
    })

    it('reads allocatable and capacity off a node', () => {
        const allowance = MetricsAllowance.ofNode({
            status: {
                allocatable: { cpu: '3800m', memory: '7Gi' },
                capacity: { cpu: '4', memory: '8Gi' },
            },
        })

        expect(allowance.cpu.request).toBeCloseTo(3.8, 6)
        expect(allowance.cpu.limit).toBe(4)
        expect(allowance.memory.request).toBe(7 * 1024 ** 3)
        expect(allowance.memory.limit).toBe(8 * 1024 ** 3)
    })

    it('answers an empty allowance for an object shaped like nothing in particular', () => {
        expect(MetricsAllowance.ofPod({})).toEqual(MetricsAllowance.empty())
        expect(MetricsAllowance.ofNode({ status: 'broken' })).toEqual(MetricsAllowance.empty())
    })
})
