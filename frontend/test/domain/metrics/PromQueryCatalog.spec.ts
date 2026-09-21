import { describe, expect, it } from 'vitest'
import { PromQueryCatalog, PrometheusLayoutCatalog } from '@/domain/models/metrics'

const stack = PrometheusLayoutCatalog.of('kubePrometheusStack')
const chart = PrometheusLayoutCatalog.of('prometheusChart')

describe('PromQueryCatalog', () => {
    it('sums the whole cluster without grouping', () => {
        const query = PromQueryCatalog.of(stack, 'cpu', { level: 'cluster' })

        expect(query).toBe('sum(rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[5m]))')
        expect(PromQueryCatalog.groupLabelOf(stack, { level: 'cluster' })).toBe('')
    })

    it('reads memory as a gauge rather than a rate', () => {
        const query = PromQueryCatalog.of(stack, 'memory', { level: 'namespace', namespace: 'prod' })

        expect(query).toBe('sum(container_memory_working_set_bytes{container!="",container!="POD",namespace="prod"})')
    })

    it('takes the node label from the layout, not from the call site', () => {
        expect(PromQueryCatalog.of(stack, 'cpu', { level: 'node', node: 'worker-1' })).toContain('node="worker-1"')
        expect(PromQueryCatalog.of(chart, 'cpu', { level: 'node', node: 'worker-1' }))
            .toContain('kubernetes_io_hostname="worker-1"')
    })

    it('breaks a workload down by pod and a pod down by container', () => {
        const workload = PromQueryCatalog.of(stack, 'cpu', { level: 'workload', namespace: 'prod', workload: 'api' })
        const pod = PromQueryCatalog.of(stack, 'cpu', { level: 'pod', namespace: 'prod', pod: 'api-1-2' })

        expect(workload).toContain('sum by (pod) (')
        expect(workload).toContain('pod=~"api-.*"')
        expect(pod).toContain('sum by (container) (')
        expect(pod).toContain('pod="api-1-2"')
        expect(PromQueryCatalog.groupLabelOf(stack, { level: 'workload' })).toBe('pod')
        expect(PromQueryCatalog.groupLabelOf(stack, { level: 'pod' })).toBe('container')
    })

    it('escapes a regular expression so a dotted name matches only itself', () => {
        const query = PromQueryCatalog.of(stack, 'cpu', { level: 'workload', namespace: 'prod', workload: 'a.b' })

        expect(query).toContain('pod=~"a\\\\.b-.*"')
    })

    it('escapes quotes and backslashes in a plain label value', () => {
        const query = PromQueryCatalog.of(stack, 'cpu', { level: 'namespace', namespace: 'we"ird\\one' })

        expect(query).toContain('namespace="we\\"ird\\\\one"')
    })

    it('names a pod rather than its workload when both are given', () => {
        const query = PromQueryCatalog.of(stack, 'cpu', {
            level: 'pod',
            namespace: 'prod',
            pod: 'api-1-2',
            workload: 'api',
        })

        expect(query).toContain('pod="api-1-2"')
        expect(query).not.toContain('=~')
    })

    it('offers a probe that costs the store nothing', () => {
        expect(PromQueryCatalog.probe()).toBe('vector(1)')
    })
})
