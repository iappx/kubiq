import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { PrometheusService } from '@/application/services/prometheus/PrometheusService'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import { SettingsService } from '@/application/services/settings/SettingsService'
import type { TClusterSettingsDraft } from '@/domain/entities/settings'
import { ApiError } from '@/domain/errors/ApiError'
import { MetricRangeCatalog, PrometheusLayoutCatalog } from '@/domain/models/metrics'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { PrometheusEntityContext } from '@/infrastructure/entityRepo/metrics/PrometheusEntityContext'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()

const connectionService = {
    connection: (clusterId: string) => ({ clusterId, sessionId: 'session-1' }),
    context: () => EntityRepo.create().use(KubeEntityContext, transport as never).getContext(KubeEntityContext),
} as unknown as ClusterConnectionService

const contexts = {
    prometheus: () => EntityRepo.create()
        .use(PrometheusEntityContext, transport as never)
        .getContext(PrometheusEntityContext),
} as unknown as KubeContextProvider

let stored: TClusterSettingsDraft | null = null

const settingsService = {
    clusterSettings: async () => stored,
} as unknown as SettingsService

const draft = (overrides: Partial<TClusterSettingsDraft>): TClusterSettingsDraft => ({
    clusterId: 'prod',
    prometheusSource: 'none',
    prometheusUrl: '',
    prometheusService: '',
    prometheusLayout: 'kubePrometheusStack',
    ...overrides,
})

const serviceList = (namespace: string, name: string, ports: unknown[]) => ({
    kind: 'ServiceList',
    items: [{ metadata: { uid: `${namespace}-${name}`, name, namespace }, spec: { ports } }],
})

const emptyList = { kind: 'ServiceList', items: [] }

const probeAnswer = { status: 'success', data: { resultType: 'vector', result: [] } }

let service: PrometheusService

describe('PrometheusService.resolve', () => {
    beforeEach(() => {
        transport.reset()
        stored = null
        service = new PrometheusService(
            connectionService,
            new ResourceListService(connectionService),
            settingsService,
            contexts,
        )
    })

    // A cluster nobody has decided about is discovered; one switched off deliberately
    // is a different state and stays off.
    it('discovers a target for a cluster with no saved row', async () => {
        transport.answerWith(serviceList('monitoring', 'prometheus-operated', [{ name: 'web', port: 9090 }]))

        const resolution = await service.resolve('prod')

        expect(resolution.state).toBe('ready')
        expect(resolution.discovered).toBe(true)
        expect(resolution.target).toEqual({ namespace: 'monitoring', service: 'prometheus-operated', port: 'web' })
        expect(resolution.layout.id).toBe('kubePrometheusStack')
    })

    it('tries the presets in order and takes the layout of the one that matched', async () => {
        transport.answerWith(emptyList)
        transport.answerWith(serviceList('monitoring', 'vmsingle-db', [{ name: 'http', port: 8429 }]))

        const resolution = await service.resolve('prod')

        expect(resolution.layout.id).toBe('victoriaMetrics')
        expect(transport.requests).toHaveLength(2)
        expect(transport.requests[0].query?.labelSelector).toBe('operated-prometheus=true')
    })

    it('says nothing was found when no preset matches', async () => {
        transport.answerWith(emptyList)
        transport.answerWith(emptyList)
        transport.answerWith(emptyList)

        await expect(service.resolve('prod')).resolves.toMatchObject({ state: 'missing', target: null })
    })

    it('keeps looking when one preset is refused', async () => {
        transport.failWith(new ApiError('denied', 'rbac', 403))
        transport.answerWith(serviceList('monitoring', 'vmsingle-db', [{ name: 'http', port: 8429 }]))

        await expect(service.resolve('prod')).resolves.toMatchObject({ state: 'ready' })
    })

    it('leaves a cluster switched off alone', async () => {
        stored = draft({ prometheusSource: 'none' })

        const resolution = await service.resolve('prod')

        expect(resolution.state).toBe('off')
        expect(transport.requests).toHaveLength(0)
    })

    // Every request in this build travels through the API server session, so a plain
    // address has no path to reach.
    it('states plainly that a direct address is not reachable from here', async () => {
        stored = draft({ prometheusSource: 'url', prometheusUrl: 'http://prometheus:9090' })

        await expect(service.resolve('prod')).resolves.toMatchObject({ state: 'unsupported', target: null })
    })

    it('probes a manually named service before charting against it', async () => {
        stored = draft({
            prometheusSource: 'service',
            prometheusService: 'obs/prom:9090',
            prometheusLayout: 'prometheusChart',
        })
        transport.answerWith(probeAnswer)

        const resolution = await service.resolve('prod')

        expect(resolution.state).toBe('ready')
        expect(resolution.discovered).toBe(false)
        expect(resolution.layout.id).toBe('prometheusChart')
        expect(transport.path).toContain('/namespaces/obs/services/prom:9090/proxy/api/v1/query')
    })

    it('reads a missing manual service as missing rather than as a broken chart', async () => {
        stored = draft({ prometheusSource: 'service', prometheusService: 'obs/prom:9090' })
        transport.failWith(new ApiError('not found', 'no endpoints', 404))

        await expect(service.resolve('prod')).resolves.toMatchObject({ state: 'missing', target: null })
    })

    it('separates a refused proxy from an absent one', async () => {
        stored = draft({ prometheusSource: 'service', prometheusService: 'obs/prom:9090' })
        transport.failWith(new ApiError('denied', 'rbac', 403))

        await expect(service.resolve('prod')).resolves.toMatchObject({ state: 'forbidden' })
    })

    it('refuses an address that is not namespace/name:port', async () => {
        stored = draft({ prometheusSource: 'service', prometheusService: 'prom' })

        await expect(service.resolve('prod')).resolves.toMatchObject({ state: 'missing' })
        expect(transport.requests).toHaveLength(0)
    })
})

describe('PrometheusService.series', () => {
    beforeEach(() => {
        transport.reset()
        service = new PrometheusService(
            connectionService,
            new ResourceListService(connectionService),
            settingsService,
            contexts,
        )
    })

    const request = (overrides: Record<string, unknown> = {}) => ({
        clusterId: 'prod',
        target: { namespace: 'monitoring', service: 'prom', port: 'web' },
        layout: PrometheusLayoutCatalog.of('kubePrometheusStack'),
        kind: 'cpu' as const,
        scope: { level: 'pod' as const, namespace: 'prod', pod: 'api-1' },
        range: MetricRangeCatalog.resolve('1h', 1_700_000_000_000),
        ...overrides,
    })

    it('labels each series by the label the query grouped on', async () => {
        transport.answerWith({
            status: 'success',
            data: {
                resultType: 'matrix',
                result: [
                    { metric: { container: 'api' }, values: [[1700000000, '0.5']] },
                    { metric: { container: 'sidecar' }, values: [[1700000000, '0.1']] },
                ],
            },
        })

        const series = await service.series(request())

        expect(series.map(entry => entry.label)).toEqual(['api', 'sidecar'])
        expect(series[0].points).toEqual([{ at: 1700000000000, value: 0.5 }])
    })

    it('falls back to the subject when the level groups on nothing', async () => {
        transport.answerWith({
            status: 'success',
            data: { resultType: 'matrix', result: [{ metric: {}, values: [[1700000000, '3']] }] },
        })

        const series = await service.series(request({ scope: { level: 'cluster' } }))

        expect(series[0].label).toBe('this cluster')
    })

    it('drops a series Prometheus answered with no samples for', async () => {
        transport.answerWith({
            status: 'success',
            data: { resultType: 'matrix', result: [{ metric: { container: 'api' }, values: [] }] },
        })

        await expect(service.series(request())).resolves.toEqual([])
    })

    it('sends the range and the step the caller chose', async () => {
        transport.answerWith({ status: 'success', data: { resultType: 'matrix', result: [] } })

        await service.series(request())

        expect(transport.path).toContain('step=30s')
        expect(transport.path).toContain('container_cpu_usage_seconds_total')
    })

    it('asks nothing when the scope names no subject', async () => {
        await expect(service.series(request({ scope: { level: 'pod', namespace: 'prod' } }))).resolves.toEqual([])
        expect(transport.requests).toHaveLength(0)
    })
})
