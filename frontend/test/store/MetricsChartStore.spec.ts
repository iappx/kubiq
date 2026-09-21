import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = {
        resolution: {
            state: 'ready',
            target: { namespace: 'monitoring', service: 'prom', port: 'web' },
            layout: { id: 'kubePrometheusStack' },
            discovered: true,
        },
        series: [{ key: 'a', label: 'api', points: [{ at: 1, value: 2 }] }],
        resolveFails: undefined as Error | undefined,
        seriesFails: undefined as Error | undefined,
    }

    return {
        state,
        resolve: vi.fn(async () => {
            if (state.resolveFails) {
                throw state.resolveFails
            }
            return state.resolution
        }),
        series: vi.fn(async () => {
            if (state.seriesFails) {
                throw state.seriesFails
            }
            return state.series
        }),
    }
})

vi.mock('@/application/services/prometheus/PrometheusService', () => ({
    PrometheusService: class {
        public resolve = fake.resolve

        public series = fake.series
    },
}))

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { ClusterSessionHandler } from '@/application/handlers/cluster/ClusterSessionHandler'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { MetricsChartKey } from '@/store/modules/metricsChart/MetricsChartKey'
import { MetricsChartStore } from '@/store/modules/metricsChart/MetricsChartStore'

container.resolve(ClusterSessionHandler)
const store = container.resolve(MetricsChartStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, (event) => {
    errors.push(event)
})

const request = { clusterId: 'prod', scope: { level: 'pod' as const, namespace: 'prod', pod: 'api-1' }, kind: 'cpu' as const }

describe('MetricsChartKey', () => {
    it('keys a chart by cluster, subject, series and range at once', () => {
        const key = MetricsChartKey.of('prod', { level: 'pod', namespace: 'prod', pod: 'api-1' }, 'cpu', '1h')

        expect(MetricsChartKey.belongsTo(key, 'prod')).toBe(true)
        expect(MetricsChartKey.belongsTo(key, 'lab')).toBe(false)
        expect(key).not.toBe(MetricsChartKey.of('prod', { level: 'pod', namespace: 'prod', pod: 'api-1' }, 'memory', '1h'))
        expect(key).not.toBe(MetricsChartKey.of('prod', { level: 'pod', namespace: 'prod', pod: 'api-1' }, 'cpu', '6h'))
    })
})

describe('MetricsChartStore', () => {
    beforeEach(() => {
        errors.length = 0
        fake.state.resolveFails = undefined
        fake.state.seriesFails = undefined
        store.targets = {}
        store.charts = {}
        store.setRange('1h')
        vi.clearAllMocks()
    })

    it('resolves a cluster once however many panels ask', async () => {
        await store.resolveOnce('prod')
        await store.resolveOnce('prod')

        expect(fake.resolve).toHaveBeenCalledTimes(1)
        expect(store.targetOf('prod').state).toBe('ready')
        expect(store.targetOf('prod').loaded).toBe(true)
    })

    it('reads charts once a target is known', async () => {
        await store.resolveOnce('prod')
        await store.load(request)

        expect(store.chartOf(request).series).toHaveLength(1)
        expect(fake.series).toHaveBeenCalledTimes(1)
    })

    // Without a target there is nothing to ask, and an empty chart is the honest answer.
    it('empties a chart rather than querying when no target was found', async () => {
        fake.state.resolution = { ...fake.state.resolution, state: 'missing', target: null } as never
        await store.resolveOnce('prod')
        await store.load(request)

        expect(fake.series).not.toHaveBeenCalled()
        expect(store.chartOf(request).series).toEqual([])
        expect(store.chartOf(request).loaded).toBe(true)

        fake.state.resolution = {
            state: 'ready',
            target: { namespace: 'monitoring', service: 'prom', port: 'web' },
            layout: { id: 'kubePrometheusStack' },
            discovered: true,
        } as never
    })

    it('keeps one range of a chart apart from another', async () => {
        await store.resolveOnce('prod')
        await store.load(request)
        store.setRange('24h')
        await store.load(request)

        expect(Object.keys(store.charts)).toHaveLength(2)
        expect(store.range).toBe('24h')
    })

    it('reads an unknown range back as the default', () => {
        store.setRange('nope' as never)

        expect(store.range).toBe('1h')
    })

    it('keeps the failure on the chart and announces it once', async () => {
        await store.resolveOnce('prod')
        fake.state.seriesFails = new ApiError('Prometheus refused the query', 'parse error')

        await store.load(request)

        expect(store.chartOf(request).error).toBe('Prometheus refused the query')
        expect(store.chartOf(request).series).toEqual([])
        expect(errors).toHaveLength(1)
    })

    it('marks a cluster it could not resolve and says so on the bus', async () => {
        fake.state.resolveFails = new Error('boom')

        await store.resolve('prod')

        expect(store.targetOf('prod').state).toBe('missing')
        expect(store.targetOf('prod').loaded).toBe(true)
        expect(errors).toHaveLength(1)
    })

    it('drops every chart of a cluster when its session closes', async () => {
        await store.resolveOnce('prod')
        await store.load(request)
        await store.resolveOnce('lab')

        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 0))

        expect(store.charts).toEqual({})
        expect(store.targetOf('prod').loaded).toBe(false)
        expect(store.targetOf('lab').loaded).toBe(true)
    })
})
