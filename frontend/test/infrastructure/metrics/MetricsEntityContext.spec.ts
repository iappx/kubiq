import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { NodeMetricsEntity, PodMetricsEntity } from '@/domain/entities/metrics'
import { MetricsEntityContext } from '@/infrastructure/entityRepo/metrics/MetricsEntityContext'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()
const context = EntityRepo.create()
    .use(MetricsEntityContext, transport as never)
    .getContext(MetricsEntityContext)

describe('MetricsEntityContext', () => {
    beforeEach(() => {
        transport.reset()
    })

    it('lists node metrics off the metrics API', async () => {
        transport.answerWith({
            kind: 'NodeMetricsList',
            items: [{ metadata: { name: 'worker-1' }, usage: { cpu: '137m', memory: '1Gi' } }],
        })

        const rows = await context.nodes.getAll()

        expect(transport.path).toBe('/apis/metrics.k8s.io/v1beta1/nodes')
        expect(rows[0]).toBeInstanceOf(NodeMetricsEntity)
        expect(rows[0].name).toBe('worker-1')
    })

    it('scopes pod metrics to one namespace through the path, not a filter', async () => {
        transport.answerWith({
            kind: 'PodMetricsList',
            items: [{ metadata: { name: 'api-1', namespace: 'prod' }, containers: [] }],
        })

        const rows = await context.pods
            .withPathParams({ [KubeUrlBuilder.namespaceParam]: 'prod' })
            .getAll()

        expect(transport.path).toBe('/apis/metrics.k8s.io/v1beta1/namespaces/prod/pods')
        expect(rows[0]).toBeInstanceOf(PodMetricsEntity)
    })

    // The API answers without a uid, and an entity with no primary key is a row the
    // repo cannot tell apart from any other.
    it('builds the primary key the response does not carry', async () => {
        transport.answerWith({
            items: [
                { metadata: { name: 'api-1', namespace: 'prod' }, containers: [] },
                { metadata: { name: 'api-2', namespace: 'prod' }, containers: [] },
            ],
        })

        const rows = await context.pods.getAll()

        expect(rows.map(row => row.key)).toEqual(['prod/api-1', 'prod/api-2'])
    })

    it('keys a node by its name alone', async () => {
        transport.answerWith({ items: [{ metadata: { name: 'worker-1' }, usage: {} }] })

        expect((await context.nodes.getAll())[0].key).toBe('worker-1')
    })

    it('reads an empty list as an empty collection', async () => {
        transport.answerWith({ kind: 'PodMetricsList', items: [] })

        await expect(context.pods.getAll()).resolves.toEqual([])
    })

    it('hands out a fresh query on every access', () => {
        expect(context.pods).not.toBe(context.pods)
    })
})
