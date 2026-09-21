import { RestResponseError } from '@iappx/entity-repo-rest'
import type { IResponseAdapter, TRequestContext, TRestResponse } from '@iappx/entity-repo-rest'
import type { TPageCursor } from '@iappx/entity-repo-query'

export class PrometheusResponseAdapter implements IResponseAdapter {
    public static readonly successStatus: string = 'success'

    public items(response: TRestResponse, context: TRequestContext): Record<string, unknown>[] {
        const payload = PrometheusResponseAdapter.envelope(response, context)
        const result = payload.result

        if (Array.isArray(result) && payload.resultType === 'scalar') {
            return [PrometheusResponseAdapter.series({}, [result], 0)]
        }
        if (!Array.isArray(result)) {
            return []
        }

        return result.map((entry, index) => PrometheusResponseAdapter.read(entry, index))
    }

    public single(response: TRestResponse, context: TRequestContext): Record<string, unknown> | undefined {
        return this.items(response, context)[0]
    }

    public total(): number | undefined {
        return undefined
    }

    public cursor(): TPageCursor | undefined {
        return undefined
    }

    private static read(entry: unknown, index: number): Record<string, unknown> {
        const row = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
        const metric = (row.metric && typeof row.metric === 'object' ? row.metric : {}) as Record<string, string>
        const values = Array.isArray(row.values)
            ? row.values as unknown[]
            : (Array.isArray(row.value) ? [row.value] : [])

        return PrometheusResponseAdapter.series(metric, values, index)
    }

    private static series(metric: Record<string, string>, values: unknown[], index: number): Record<string, unknown> {
        return { key: PrometheusResponseAdapter.keyOf(metric, index), metric, values }
    }

    // Prometheus never repeats a label set inside one result, so the sorted pairs key it.
    private static keyOf(metric: Record<string, string>, index: number): string {
        const names = Object.keys(metric).sort()
        if (names.length === 0) {
            return `series-${index}`
        }

        return names.map(name => `${name}=${metric[name]}`).join(',')
    }

    private static envelope(response: TRestResponse, context: TRequestContext): Record<string, unknown> {
        const data = response.data
        if (!data || typeof data !== 'object') {
            throw new RestResponseError(`${context.url} did not answer with a Prometheus result`, data)
        }

        const body = data as Record<string, unknown>
        if (body.status !== PrometheusResponseAdapter.successStatus) {
            const reported = typeof body.error === 'string' ? body.error : String(body.status)
            throw new RestResponseError(`Prometheus refused the query: ${reported}`, data)
        }

        const payload = body.data
        if (!payload || typeof payload !== 'object') {
            throw new RestResponseError(`${context.url} answered without a result`, data)
        }

        return payload as Record<string, unknown>
    }
}
