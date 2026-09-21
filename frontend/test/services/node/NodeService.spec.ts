import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { NodeService } from '@/application/services/node/NodeService'
import { NodeDrainLimits } from '@/application/services/node/constants/NodeDrainLimits'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import type { TNodeTarget } from '@/application/services/node/types/TNodeTarget'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()

const nodes = KubeResourceRegistry.find('', 'nodes')!
const pods = KubeResourceRegistry.find('', 'pods')!

const connectionService = {
    context: () => EntityRepo.create().use(KubeEntityContext, transport as never).getContext(KubeEntityContext),
} as unknown as ClusterConnectionService

const target: TNodeTarget = {
    clusterId: 'prod',
    kind: nodes,
    name: 'worker-1',
    rowKey: 'worker-1-uid',
}

const podList = (items: Record<string, unknown>[]) => ({
    apiVersion: 'v1',
    kind: 'PodList',
    metadata: { resourceVersion: '42' },
    items,
})

const runningPod = (name: string, extra: Record<string, unknown> = {}) => ({
    metadata: { uid: `${name}-uid`, name, namespace: 'payments', ...(extra.metadata as object ?? {}) },
    spec: { nodeName: 'worker-1' },
    status: { phase: extra.phase ?? 'Running' },
})

const body = () => (transport.last.body ?? {}) as Record<string, any>

let service: NodeService

describe('NodeService cordon and uncordon', () => {
    beforeEach(() => {
        transport.reset()
        service = new NodeService(connectionService, new ResourceListService(connectionService))
    })

    it('patches only spec.unschedulable, addressed by node name', async () => {
        transport.answerWith({})

        await service.cordon(target)

        expect(transport.last.method).toBe('PATCH')
        expect(transport.last.url).toBe('/api/v1/nodes/worker-1')
        expect(body()).toEqual({ spec: { unschedulable: true } })
    })

    it('clears the flag rather than removing it', async () => {
        transport.answerWith({})

        await service.uncordon(target)

        expect(body()).toEqual({ spec: { unschedulable: false } })
    })
})

describe('NodeService.podsOn', () => {
    beforeEach(() => {
        transport.reset()
        service = new NodeService(connectionService, new ResourceListService(connectionService))
    })

    it('asks the cluster for the node, it does not filter a full list afterwards', async () => {
        transport.answerWith(podList([runningPod('web')]))

        const found = await service.podsOn({ clusterId: 'prod', podsKind: pods, nodeName: 'worker-1' })

        expect(transport.path).toContain('fieldSelector=spec.nodeName=worker-1')
        expect(transport.path).toContain(`limit=${NodeDrainLimits.maxPods}`)
        expect(found.map(pod => pod.name)).toEqual(['web'])
    })
})

describe('NodeService.drain', () => {
    beforeEach(() => {
        transport.reset()
        service = new NodeService(connectionService, new ResourceListService(connectionService))
    })

    it('cordons first, then posts an eviction per evictable pod', async () => {
        transport.answerWith({})
        transport.answerWith(podList([
            runningPod('web'),
            runningPod('fluentd', { metadata: { ownerReferences: [{ kind: 'DaemonSet', name: 'fluentd', uid: 'ds' }] } }),
            runningPod('backup', { phase: 'Succeeded' }),
        ]))
        transport.answerWith({})

        const result = await service.drain({ target, podsKind: pods })

        expect(transport.requests[0].method).toBe('PATCH')
        expect(transport.requests[0].url).toBe('/api/v1/nodes/worker-1')
        expect(transport.requests[2].method).toBe('POST')
        expect(transport.requests[2].url).toBe('/api/v1/namespaces/payments/pods/web/eviction')
        expect(body()).toEqual({
            apiVersion: NodeDrainLimits.evictionApiVersion,
            kind: NodeDrainLimits.evictionKind,
            metadata: { name: 'web', namespace: 'payments' },
        })
        expect(result).toEqual({ evicted: 1, skipped: 2, failures: [] })
    })

    it('reports a refused eviction instead of stopping the drain', async () => {
        transport.answerWith({})
        transport.answerWith(podList([runningPod('web'), runningPod('api')]))
        transport.failWith(new ApiError('Cannot evict pod as it would violate the budget', 'TooManyRequests', 429))
        transport.answerWith({})

        const result = await service.drain({ target, podsKind: pods })

        expect(result.evicted).toBe(1)
        expect(result.skipped).toBe(0)
        expect(result.failures).toEqual([
            { name: 'web', namespace: 'payments', message: 'Cannot evict pod as it would violate the budget' },
        ])
    })
})
