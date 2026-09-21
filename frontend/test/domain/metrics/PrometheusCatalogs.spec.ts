import { describe, expect, it } from 'vitest'
import {
    MetricLevelCatalog,
    MetricRangeCatalog,
    MetricsKinds,
    MetricsNoticeCatalog,
    PrometheusLayoutCatalog,
    PrometheusPresetCatalog,
    PrometheusTargetAddress,
} from '@/domain/models/metrics'

describe('PrometheusLayoutCatalog', () => {
    it('knows one layout per preset and falls back to the default', () => {
        expect(PrometheusLayoutCatalog.ids()).toEqual(['kubePrometheusStack', 'victoriaMetrics', 'prometheusChart'])
        expect(PrometheusLayoutCatalog.parse('thanos')).toBe('kubePrometheusStack')
        expect(PrometheusLayoutCatalog.parse(undefined)).toBe('kubePrometheusStack')
        expect(PrometheusLayoutCatalog.of('victoriaMetrics').id).toBe('victoriaMetrics')
        expect(PrometheusLayoutCatalog.title('prometheusChart')).toBe('Prometheus Helm chart')
        expect(PrometheusLayoutCatalog.has('vmsingle')).toBe(false)
    })

    it('gives every layout the labels a query needs', () => {
        PrometheusLayoutCatalog.all().forEach((layout) => {
            expect(layout.namespaceLabel).not.toBe('')
            expect(layout.podLabel).not.toBe('')
            expect(layout.containerLabel).not.toBe('')
            expect(layout.nodeLabel).not.toBe('')
            expect(layout.rateWindow).not.toBe('')
        })
    })
})

describe('PrometheusPresetCatalog', () => {
    it('carries one discovery preset per layout, in the order they are tried', () => {
        expect(PrometheusPresetCatalog.all().map(preset => preset.id))
            .toEqual(['kubePrometheusStack', 'victoriaMetrics', 'prometheusChart'])
        expect(PrometheusPresetCatalog.of('victoriaMetrics')?.labelSelector).toContain('app.kubernetes.io/name')
    })

    it('prefers a named port, then a known number, then whatever is there', () => {
        const preset = PrometheusPresetCatalog.of('kubePrometheusStack')!

        expect(PrometheusPresetCatalog.portOf(preset, [{ name: 'web', port: 9090 }])).toBe('web')
        expect(PrometheusPresetCatalog.portOf(preset, [{ port: 9090 }])).toBe('9090')
        expect(PrometheusPresetCatalog.portOf(preset, [{ port: 1234 }])).toBe('1234')
        expect(PrometheusPresetCatalog.portOf(preset, [])).toBe('')
    })
})

describe('PrometheusTargetAddress', () => {
    it('reads namespace/name:port in both directions', () => {
        expect(PrometheusTargetAddress.parse('monitoring/prometheus:9090'))
            .toEqual({ namespace: 'monitoring', service: 'prometheus', port: '9090' })
        expect(PrometheusTargetAddress.parse('monitoring/prometheus-operated:web')?.port).toBe('web')
        expect(PrometheusTargetAddress.format({ namespace: 'a', service: 'b', port: 'c' })).toBe('a/b:c')
    })

    it('refuses anything that is not one', () => {
        expect(PrometheusTargetAddress.parse('prometheus:9090')).toBeNull()
        expect(PrometheusTargetAddress.parse('monitoring/prometheus')).toBeNull()
        expect(PrometheusTargetAddress.parse('')).toBeNull()
        expect(PrometheusTargetAddress.parse(undefined)).toBeNull()
    })
})

describe('MetricRangeCatalog', () => {
    it('offers four spans and resolves one into seconds', () => {
        expect(MetricRangeCatalog.all()).toEqual(['1h', '6h', '24h', '7d'])
        expect(MetricRangeCatalog.parse('nope')).toBe('1h')

        const range = MetricRangeCatalog.resolve('6h', 1_000_000_000_000)

        expect(range.to).toBe(1_000_000_000)
        expect(range.to - range.from).toBe(6 * 3600)
        expect(range.stepSeconds).toBe(120)
    })

    it('keeps every span under a thousand points', () => {
        MetricRangeCatalog.all().forEach((id) => {
            const range = MetricRangeCatalog.resolve(id, Date.now())

            expect((range.to - range.from) / range.stepSeconds).toBeLessThan(1000)
        })
    })
})

describe('MetricLevelCatalog', () => {
    it('keys a scope so two different subjects never share a chart', () => {
        const pod = { level: 'pod' as const, namespace: 'prod', pod: 'api-1' }
        const other = { level: 'pod' as const, namespace: 'prod', pod: 'api-2' }

        expect(MetricLevelCatalog.keyOf(pod)).not.toBe(MetricLevelCatalog.keyOf(other))
        expect(MetricLevelCatalog.keyOf(pod)).toBe(MetricLevelCatalog.keyOf({ ...pod }))
    })

    it('names the subject a chart is about', () => {
        expect(MetricLevelCatalog.subjectOf({ level: 'cluster' })).toBe('this cluster')
        expect(MetricLevelCatalog.subjectOf({ level: 'node', node: 'worker-1' })).toBe('worker-1')
        expect(MetricLevelCatalog.subjectOf({ level: 'namespace', namespace: 'prod' })).toBe('prod')
        expect(MetricLevelCatalog.subjectOf({ level: 'workload', namespace: 'prod', workload: 'api' })).toBe('prod/api')
    })

    it('refuses a scope that names no subject', () => {
        expect(MetricLevelCatalog.isAddressable({ level: 'cluster' })).toBe(true)
        expect(MetricLevelCatalog.isAddressable({ level: 'node' })).toBe(false)
        expect(MetricLevelCatalog.isAddressable({ level: 'namespace', namespace: 'prod' })).toBe(true)
        expect(MetricLevelCatalog.isAddressable({ level: 'pod', namespace: 'prod' })).toBe(false)
        expect(MetricLevelCatalog.isAddressable({ level: 'pod', namespace: 'prod', pod: 'api-1' })).toBe(true)
    })
})

describe('MetricsKinds', () => {
    it('addresses the metrics API the same way every other kind is addressed', () => {
        expect(MetricsKinds.nodes().listPath()).toBe('/apis/metrics.k8s.io/v1beta1/nodes')
        expect(MetricsKinds.pods().listPath('prod')).toBe('/apis/metrics.k8s.io/v1beta1/namespaces/prod/pods')
        expect(MetricsKinds.pods().namespaced).toBe(true)
        expect(MetricsKinds.nodes().namespaced).toBe(false)
        expect(MetricsKinds.nodes().canList).toBe(true)
    })
})

describe('MetricsNoticeCatalog', () => {
    it('explains every state it can be asked about', () => {
        const states = ['ready', 'off', 'missing', 'forbidden', 'unsupported'] as const

        states.forEach((state) => {
            expect(MetricsNoticeCatalog.usage(state).title).not.toBe('')
            expect(MetricsNoticeCatalog.history(state).title).not.toBe('')
        })

        expect(MetricsNoticeCatalog.usage('missing').description).toContain('metrics-server')
        expect(MetricsNoticeCatalog.history('off').description).toContain('settings')
        expect(MetricsNoticeCatalog.isReady('ready')).toBe(true)
        expect(MetricsNoticeCatalog.isReady('missing')).toBe(false)
    })
})
