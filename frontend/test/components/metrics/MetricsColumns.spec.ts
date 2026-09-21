import { describe, expect, it } from 'vitest'
import { MetricsColumns } from '@/components/metrics/MetricsColumns'
import { MetricsScope } from '@/components/metrics/MetricsScope'
import { ResourceColumns } from '@/components/resource/ResourceColumns'
import { DetailTabs } from '@/components/resource/detail/DetailTabs'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'
import { KubeResourceRegistry } from '@/domain/models/kube'

const pods = KubeResourceRegistry.find('', 'pods')!
const nodes = KubeResourceRegistry.find('', 'nodes')!
const namespaces = KubeResourceRegistry.find('', 'namespaces')!
const deployments = KubeResourceRegistry.find('apps', 'deployments')!
const secrets = KubeResourceRegistry.find('', 'secrets')!

const row = (name: string, namespace: string): TResourceRow => ({
    key: `${namespace}/${name}`,
    name,
    namespace,
    createdAt: '',
    tone: 'ok',
    statusTitle: 'Running',
})

describe('MetricsScope', () => {
    it('offers live usage only where metrics.k8s.io has an object', () => {
        expect(MetricsScope.supportsUsage(pods)).toBe(true)
        expect(MetricsScope.supportsUsage(nodes)).toBe(true)
        expect(MetricsScope.supportsUsage(deployments)).toBe(false)
        expect(MetricsScope.supportsUsage(null)).toBe(false)
    })

    it('offers history everywhere a PromQL selector can name the subject', () => {
        expect(MetricsScope.supportsHistory(pods)).toBe(true)
        expect(MetricsScope.supportsHistory(nodes)).toBe(true)
        expect(MetricsScope.supportsHistory(namespaces)).toBe(true)
        expect(MetricsScope.supportsHistory(deployments)).toBe(true)
        expect(MetricsScope.supportsHistory(secrets)).toBe(false)
    })

    it('builds the scope each kind is charted at', () => {
        expect(MetricsScope.of(pods, 'prod', 'api-1')).toEqual({ level: 'pod', namespace: 'prod', pod: 'api-1' })
        expect(MetricsScope.of(nodes, '', 'worker-1')).toEqual({ level: 'node', node: 'worker-1' })
        expect(MetricsScope.of(namespaces, '', 'prod')).toEqual({ level: 'namespace', namespace: 'prod' })
        expect(MetricsScope.of(deployments, 'prod', 'api'))
            .toEqual({ level: 'workload', namespace: 'prod', workload: 'api' })
        expect(MetricsScope.of(null, '', '')).toEqual({ level: 'cluster' })
    })
})

describe('MetricsColumns', () => {
    it('adds usage columns only to the kinds that have usage', () => {
        expect(MetricsColumns.supports(pods)).toBe(true)
        expect(MetricsColumns.supports(deployments)).toBe(false)
        expect(MetricsColumns.isPodKind(pods)).toBe(true)
        expect(MetricsColumns.isPodKind(nodes)).toBe(false)
    })

    // Age closes every table in the brief, so usage goes in front of it.
    it('puts the two columns in front of Age rather than after it', () => {
        const extended = MetricsColumns.extend(pods.columns, ResourceColumns.ageKey)
        const keys = extended.map(column => column.key)

        expect(keys).toContain(MetricsColumns.cpuKey)
        expect(keys.indexOf(MetricsColumns.cpuKey)).toBeLessThan(keys.indexOf(ResourceColumns.ageKey))
        expect(keys[keys.length - 1]).toBe(ResourceColumns.ageKey)
    })

    it('appends them when the kind has no Age column at all', () => {
        const extended = MetricsColumns.extend([{ key: 'name', title: 'Name' }], ResourceColumns.ageKey)

        expect(extended.map(column => column.key)).toEqual(['name', MetricsColumns.cpuKey, MetricsColumns.memoryKey])
    })

    it('right-aligns them so the figures line up', () => {
        MetricsColumns.extend([], ResourceColumns.ageKey).forEach((column) => {
            expect(column.align).toBe('right')
        })
    })

    it('formats the usage of a row and leaves an unmeasured one blank', () => {
        const measured = MetricsColumns.apply(row('api-1', 'prod'), { cpuCores: 0.137, memoryBytes: 1024 * 1024 })
        const unmeasured = MetricsColumns.apply(row('api-2', 'prod'), null)

        expect(measured[MetricsColumns.cpuKey]).toBe('137m')
        expect(measured[MetricsColumns.memoryKey]).toBe('1 MiB')
        expect(unmeasured[MetricsColumns.cpuKey]).toBe('')
        expect(unmeasured.name).toBe('api-2')
    })
})

describe('DetailTabs with metrics', () => {
    it('discloses a Metrics tab exactly where there is something to chart', () => {
        expect(DetailTabs.of(pods).map(tab => tab.key)).toContain(DetailTabs.metricsKey)
        expect(DetailTabs.of(deployments).map(tab => tab.key)).toContain(DetailTabs.metricsKey)
        expect(DetailTabs.of(secrets).map(tab => tab.key)).not.toContain(DetailTabs.metricsKey)
        expect(DetailTabs.of(null).map(tab => tab.key)).not.toContain(DetailTabs.metricsKey)
    })
})
