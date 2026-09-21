import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import { ResourceDeletePolicy } from '@/application/services/resourceList/constants/ResourceDeletePolicy'
import { ResourceListLimits } from '@/application/services/resourceList/constants/ResourceListLimits'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { KubeResourceKind, KubeResourceRegistry } from '@/domain/models/kube'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'
import { MemoryWatchTransport } from '../../support/MemoryWatchTransport'

const transport = new MemoryKubeTransport()

const pods = KubeResourceRegistry.find('', 'pods')!
const nodes = KubeResourceRegistry.find('', 'nodes')!

const widgets = new KubeResourceKind({
    group: 'acme.example.com',
    version: 'v1',
    resource: 'widgets',
    kind: 'Widget',
    title: 'Widgets',
    namespaced: true,
    section: 'custom',
    icon: 'Puzzle',
    columns: [],
    verbs: ['list', 'delete'],
})

let service: ResourceListService

const podList = (names: string[], remaining?: number, resourceVersion?: string) => ({
    metadata: {
        ...(remaining === undefined ? {} : { remainingItemCount: remaining }),
        ...(resourceVersion === undefined ? {} : { resourceVersion }),
    },
    items: names.map(name => ({ metadata: { uid: name, name, namespace: 'payments' } })),
})

const stream = new MemoryWatchTransport()
const released: string[] = []

const connectionService = {
    context: () => EntityRepo.create().use(KubeEntityContext, transport as never).getContext(KubeEntityContext),
    stream: () => stream,
    registerStream: (clusterId: string) => () => released.push(clusterId),
} as unknown as ClusterConnectionService

describe('ResourceListService.list', () => {
    beforeEach(() => {
        transport.reset()
        service = new ResourceListService(connectionService)
    })

    it('lists a kind across every namespace when nothing is scoped', async () => {
        transport.answerWith(podList(['api-0']))

        const result = await service.list({ clusterId: 'prod', kind: pods })

        expect(transport.last.url).toBe('/api/v1/pods')
        expect(result.items).toHaveLength(1)
    })

    it('asks once per selected namespace and merges the answers', async () => {
        transport.answerWith(podList(['api-0']))
        transport.answerWith(podList(['worker-0']))

        const result = await service.list({ clusterId: 'prod', kind: pods, namespaces: ['payments', 'ledger'] })

        expect(transport.requests.map(request => request.url).sort()).toEqual([
            '/api/v1/namespaces/ledger/pods',
            '/api/v1/namespaces/payments/pods',
        ])
        expect(result.items).toHaveLength(2)
    })

    it('ignores a namespace scope on a cluster-scoped kind', async () => {
        transport.answerWith({ items: [] })

        await service.list({ clusterId: 'prod', kind: nodes, namespaces: ['payments'] })

        expect(transport.last.url).toBe('/api/v1/nodes')
    })

    it('puts a label selector in the request rather than filtering afterwards', async () => {
        transport.answerWith(podList(['api-0']))

        await service.list({ clusterId: 'prod', kind: pods, labelSelector: 'app=api' })

        expect(transport.path).toContain('labelSelector=app=api')
    })

    it('asks for one page rather than the whole collection', async () => {
        transport.answerWith(podList(['api-0']))

        await service.list({ clusterId: 'prod', kind: pods })

        expect(transport.path).toContain(`limit=${ResourceListLimits.pageSize}`)
    })

    it('honours a limit the caller sets', async () => {
        transport.answerWith(podList(['api-0']))

        await service.list({ clusterId: 'prod', kind: pods, limit: 10 })

        expect(transport.path).toContain('limit=10')
    })

    it('reports the total the cluster gave it', async () => {
        transport.answerWith(podList(['api-0'], 41))

        await expect(service.list({ clusterId: 'prod', kind: pods })).resolves.toMatchObject({ total: 42 })
    })

    it('adds up the totals of every namespace it asked', async () => {
        transport.answerWith(podList(['api-0'], 4))
        transport.answerWith(podList(['worker-0'], 9))

        const result = await service.list({ clusterId: 'prod', kind: pods, namespaces: ['payments', 'ledger'] })

        expect(result.total).toBe(15)
    })

    it('reports no total at all when one namespace did not give one', async () => {
        transport.answerWith(podList(['api-0'], 4))
        transport.answerWith(podList(['worker-0']))

        const result = await service.list({ clusterId: 'prod', kind: pods, namespaces: ['payments', 'ledger'] })

        expect(result.total).toBeUndefined()
    })

    it('lists a kind with no entity of its own through the generic set', async () => {
        transport.answerWith({ items: [{ metadata: { uid: 'w-1', name: 'widget-a', namespace: 'lab' } }] })

        const result = await service.list({ clusterId: 'prod', kind: widgets })

        expect(transport.last.url).toBe('/apis/acme.example.com/v1/widgets')
        expect(result.items).toHaveLength(1)
    })

    it('puts a field selector in the request as well', async () => {
        transport.answerWith(podList(['api-0']))

        await service.list({ clusterId: 'prod', kind: pods, fieldSelector: 'status.phase=Running' })

        expect(transport.path).toContain('fieldSelector=status.phase=Running')
    })

    it('reports the resourceVersion the page was read at, per namespace', async () => {
        transport.answerWith(podList(['api-0'], undefined, '4011'))
        transport.answerWith(podList(['worker-0'], undefined, '4012'))

        const result = await service.list({ clusterId: 'prod', kind: pods, namespaces: ['payments', 'ledger'] })

        expect(result.cursors).toEqual([
            { namespace: 'payments', resourceVersion: '4011' },
            { namespace: 'ledger', resourceVersion: '4012' },
        ])
    })

    it('reports an empty cursor when the cluster named no resourceVersion', async () => {
        transport.answerWith(podList(['api-0']))

        const result = await service.list({ clusterId: 'prod', kind: pods })

        expect(result.cursors).toEqual([{ namespace: '', resourceVersion: '' }])
    })
})

describe('ResourceListService.watch', () => {
    beforeEach(() => {
        transport.reset()
        stream.reset()
        released.length = 0
        service = new ResourceListService(connectionService)
    })

    const handler = { onEvent: () => undefined, onClose: () => undefined }

    it('watches the same path the list would have asked for', async () => {
        await service.watch({
            clusterId: 'prod',
            kind: pods,
            namespace: 'payments',
            resourceVersion: '17',
        }, handler)

        expect(stream.lastRequest).toMatchObject({ path: '/api/v1/namespaces/payments/pods', resourceVersion: '17' })
    })

    it('ignores a namespace on a cluster-scoped kind', async () => {
        await service.watch({ clusterId: 'prod', kind: nodes, namespace: 'payments', resourceVersion: '1' }, handler)

        expect(stream.lastRequest.path).toBe('/api/v1/nodes')
    })

    it('registers the stream with the cluster and releases it when stopped', async () => {
        const open = await service.watch({ clusterId: 'prod', kind: pods, namespace: '', resourceVersion: '1' }, handler)

        expect(released).toEqual([])
        await open.stop()
        expect(released).toEqual(['prod'])
    })

    it('builds an entity out of a watched object, uid and all', () => {
        const entity = service.toEntity('prod', pods, { metadata: { uid: 'api-0', name: 'api-0', namespace: 'payments' } })

        expect(entity).toMatchObject({ uid: 'api-0', name: 'api-0', namespace: 'payments' })
    })
})

describe('ResourceListService.delete', () => {
    beforeEach(() => {
        transport.reset()
        service = new ResourceListService(connectionService)
    })

    it('addresses the object by kind, namespace and name', async () => {
        transport.answerWith({})

        await service.delete('prod', pods, 'api-0', 'payments')

        expect(transport.last.url).toBe('/api/v1/namespaces/payments/pods/api-0')
        expect(transport.last.method).toBe('DELETE')
    })

    it('leaves the namespace out for a cluster-scoped kind', async () => {
        transport.answerWith({})

        await service.delete('prod', nodes, 'node-a', '')

        expect(transport.last.url).toBe('/api/v1/nodes/node-a')
    })

    it('names the propagation policy the confirmation shows', async () => {
        transport.answerWith({})

        await service.delete('prod', pods, 'api-0', 'payments')

        expect(transport.path).toContain(`propagationPolicy=${ResourceDeletePolicy.applied}`)
    })
})
