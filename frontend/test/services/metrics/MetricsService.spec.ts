import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { MetricsService } from '@/application/services/metrics/MetricsService'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import { MetricsEntityContext } from '@/infrastructure/entityRepo/metrics/MetricsEntityContext'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()

let connected = true

const connectionService = {
    connection: (clusterId: string) => (connected ? { clusterId, sessionId: 'session-1' } : null),
} as unknown as ClusterConnectionService

const contexts = {
    metrics: () => EntityRepo.create()
        .use(MetricsEntityContext, transport as never)
        .getContext(MetricsEntityContext),
} as unknown as KubeContextProvider

const nodeList = (rows: [string, string, string][]) => ({
    kind: 'NodeMetricsList',
    items: rows.map(([name, cpu, memory]) => ({ metadata: { name }, usage: { cpu, memory } })),
})

const podList = (rows: [string, string, string, string][]) => ({
    kind: 'PodMetricsList',
    items: rows.map(([namespace, name, cpu, memory]) => ({
        metadata: { name, namespace },
        containers: [{ name: 'main', usage: { cpu, memory } }],
    })),
})

let service: MetricsService

describe('MetricsService', () => {
    beforeEach(() => {
        transport.reset()
        connected = true
        service = new MetricsService(connectionService, contexts)
    })

    it('reports node usage keyed by node name', async () => {
        transport.answerWith(nodeList([['worker-1', '137m', '1Gi'], ['worker-2', '2', '2Gi']]))

        const snapshot = await service.nodeUsage('prod')

        expect(snapshot.state).toBe('ready')
        expect(snapshot.usage['worker-1'].cpuCores).toBeCloseTo(0.137, 6)
        expect(snapshot.usage['worker-2'].memoryBytes).toBe(2 * 1024 ** 3)
    })

    it('reports pod usage keyed by namespace and name', async () => {
        transport.answerWith(podList([['prod', 'api-1', '10m', '20Mi']]))

        const snapshot = await service.podUsage('prod', [])

        expect(snapshot.usage['prod/api-1'].cpuCores).toBeCloseTo(0.01, 6)
        expect(transport.path).toBe('/apis/metrics.k8s.io/v1beta1/pods')
    })

    // The API server scopes a list to one namespace, so a selection of several is
    // that many requests rather than one list filtered afterwards.
    it('asks each selected namespace in a request of its own', async () => {
        transport.answerWith(podList([['prod', 'api-1', '10m', '20Mi']]))
        transport.answerWith(podList([['lab', 'api-2', '20m', '40Mi']]))

        const snapshot = await service.podUsage('prod', ['prod', 'lab'])

        expect(transport.requests).toHaveLength(2)
        expect(Object.keys(snapshot.usage).sort()).toEqual(['lab/api-2', 'prod/api-1'])
    })

    it('reads a cluster with no metrics-server as a state, not an error', async () => {
        transport.failWith(new ApiError('not found', 'no such api', 404))

        const snapshot = await service.nodeUsage('prod')

        expect(snapshot.state).toBe('missing')
        expect(snapshot.usage).toEqual({})
    })

    it('reads a metrics API that is not ready yet the same way', async () => {
        transport.failWith(new ApiError('unavailable', 'no endpoints', 503))

        await expect(service.podUsage('prod', [])).resolves.toMatchObject({ state: 'missing' })
    })

    it('separates being refused from being absent', async () => {
        transport.failWith(new ApiError('denied', 'rbac', 403))

        await expect(service.nodeUsage('prod')).resolves.toMatchObject({ state: 'forbidden' })
    })

    // Anything else is a genuine failure, and swallowing it would leave an empty
    // block on screen with nothing said about why.
    it('lets a failure it cannot explain travel on', async () => {
        transport.failWith(new ApiError('broken', 'internal', 500))

        await expect(service.nodeUsage('prod')).rejects.toThrow('broken')
    })

    it('says nothing is available when the cluster is not connected', async () => {
        connected = false

        await expect(service.nodeUsage('prod')).resolves.toMatchObject({ state: 'missing' })
        expect(transport.requests).toHaveLength(0)
    })
})
