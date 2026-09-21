import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { PrometheusSeriesEntity } from '@/domain/entities/metrics'
import { PrometheusApiParams } from '@/infrastructure/entityRepo/metrics/PrometheusApiParams'
import { PrometheusEntityContext } from '@/infrastructure/entityRepo/metrics/PrometheusEntityContext'
import { PrometheusQueryMeta } from '@/infrastructure/entityRepo/metrics/PrometheusQueryMeta'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()
const context = EntityRepo.create()
    .use(PrometheusEntityContext, transport as never)
    .getContext(PrometheusEntityContext)

const target = { namespace: 'monitoring', service: 'prometheus-operated', port: 'web' }

const matrix = (values: [number, string][]) => ({
    status: 'success',
    data: { resultType: 'matrix', result: [{ metric: { pod: 'api-1' }, values }] },
})

describe('PrometheusEntityContext', () => {
    beforeEach(() => {
        transport.reset()
    })

    it('reaches Prometheus through the API server proxy, not over a path of its own', async () => {
        transport.answerWith(matrix([[1700000000, '0.5']]))

        await context.range
            .withMeta(PrometheusQueryMeta.forTarget(target))
            .withQueryParams({
                [PrometheusApiParams.query]: 'sum(up)',
                [PrometheusApiParams.start]: 1,
                [PrometheusApiParams.end]: 2,
                [PrometheusApiParams.step]: '30s',
            })
            .getAll()

        expect(transport.path).toBe(
            '/api/v1/namespaces/monitoring/services/prometheus-operated:web/proxy/api/v1/query_range'
            + '?query=sum(up)&start=1&end=2&step=30s',
        )
    })

    it('sends an instant query to the other endpoint of the same proxy', async () => {
        transport.answerWith({ status: 'success', data: { resultType: 'vector', result: [] } })

        await context.instant
            .withMeta(PrometheusQueryMeta.forTarget(target))
            .withQueryParams({ [PrometheusApiParams.query]: 'vector(1)' })
            .getAll()

        expect(transport.path).toContain('/proxy/api/v1/query?query=vector(1)')
    })

    it('turns a matrix into series carrying their labels', async () => {
        transport.answerWith(matrix([[1700000000, '0.5'], [1700000030, '1.5']]))

        const rows = await context.range.withMeta(PrometheusQueryMeta.forTarget(target)).getAll()

        expect(rows[0]).toBeInstanceOf(PrometheusSeriesEntity)
        expect(rows[0].key).toBe('pod=api-1')
        expect(rows[0].labelOf('pod')).toBe('api-1')
        expect(rows[0].points).toHaveLength(2)
    })

    it('normalises an instant vector onto the same shape as a range', async () => {
        transport.answerWith({
            status: 'success',
            data: { resultType: 'vector', result: [{ metric: { node: 'worker-1' }, value: [1700000000, '3'] }] },
        })

        const rows = await context.instant.withMeta(PrometheusQueryMeta.forTarget(target)).getAll()

        expect(rows[0].points).toEqual([{ at: 1700000000000, value: 3 }])
    })

    it('reads a scalar answer as one nameless series', async () => {
        transport.answerWith({ status: 'success', data: { resultType: 'scalar', result: [1700000000, '1'] } })

        const rows = await context.instant.withMeta(PrometheusQueryMeta.forTarget(target)).getAll()

        expect(rows).toHaveLength(1)
        expect(rows[0].key).toBe('series-0')
        expect(rows[0].points).toEqual([{ at: 1700000000000, value: 1 }])
    })

    it('treats a refused query as a failure rather than an empty chart', async () => {
        transport.answerWith({ status: 'error', errorType: 'bad_data', error: 'parse error' })

        await expect(context.range.withMeta(PrometheusQueryMeta.forTarget(target)).getAll())
            .rejects.toThrow(/parse error/)
    })

    it('refuses to build a path when no service was named', async () => {
        await expect(context.range.getAll()).rejects.toThrow(/Prometheus service/)
    })

    // The AST has no meaning here, so it is refused before a request is built rather
    // than silently dropped on the way out.
    it('refuses a filter instead of sending a request Prometheus cannot answer', async () => {
        await expect(
            context.range
                .withMeta(PrometheusQueryMeta.forTarget(target))
                .where(f => f.eq('key', 'x'))
                .getAll(),
        ).rejects.toThrow()

        expect(transport.requests).toHaveLength(0)
    })

    it('refuses an ordering the query language does not have', async () => {
        await expect(
            context.range
                .withMeta(PrometheusQueryMeta.forTarget(target))
                .orderBy('key', 'asc')
                .getAll(),
        ).rejects.toThrow()
    })
})

describe('PrometheusQueryMeta', () => {
    it('defaults to the range endpoint and refuses a half-written target', () => {
        expect(PrometheusQueryMeta.endpointOf(undefined)).toBe('query_range')
        expect(PrometheusQueryMeta.endpointOf(PrometheusQueryMeta.forEndpoint('query'))).toBe('query')
        expect(PrometheusQueryMeta.targetOf(undefined)).toBeUndefined()
        expect(PrometheusQueryMeta.targetOf({ prometheusTarget: { namespace: 'a' } })).toBeUndefined()
        expect(PrometheusQueryMeta.targetOf(PrometheusQueryMeta.forTarget(target))).toEqual(target)
    })
})
