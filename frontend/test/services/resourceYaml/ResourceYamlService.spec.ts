import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { ResourceYamlService } from '@/application/services/resourceYaml/ResourceYamlService'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeResourceKind, KubeResourceRegistry } from '@/domain/models/kube'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import { KubeObjectAdapter } from '@/infrastructure/kube/KubeObjectAdapter'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()

const deployments = KubeResourceRegistry.find('apps', 'deployments')!
const secrets = KubeResourceRegistry.find('', 'secrets')!

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
    verbs: ['list', 'get', 'create', 'update', 'patch'],
})

const connectionService = {
    context: () => EntityRepo.create().use(KubeEntityContext, transport as never).getContext(KubeEntityContext),
    connection: () => ({ clusterId: 'prod', sessionId: 'session-1' }),
    connections: [{ clusterId: 'prod', sessionId: 'session-1' }],
} as unknown as ClusterConnectionService

const contexts = { request: () => transport } as unknown as KubeContextProvider

const deployment = (changes: Record<string, unknown> = {}) => ({
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
        name: 'api',
        namespace: 'payments',
        resourceVersion: '4011',
        uid: 'd-1',
        labels: { app: 'api' },
        managedFields: [{ manager: 'kube-controller-manager' }],
    },
    spec: { replicas: 3 },
    status: { readyReplicas: 3 },
    ...changes,
})

let service: ResourceYamlService

const target = { clusterId: 'prod', kind: deployments, name: 'api', namespace: 'payments' }

describe('ResourceYamlService.read', () => {
    beforeEach(() => {
        transport.reset()
        service = new ResourceYamlService(connectionService, new KubeObjectAdapter(contexts))
    })

    it('reads the object at the path the kind builds', async () => {
        transport.answerWith(deployment())

        await service.read(target)

        expect(transport.last.url).toBe('/apis/apps/v1/namespaces/payments/deployments/api')
    })

    it('leaves the namespace out for a cluster-scoped kind', async () => {
        transport.answerWith({ metadata: { name: 'node-a' } })

        await service.read({ ...target, kind: KubeResourceRegistry.find('', 'nodes')!, name: 'node-a' })

        expect(transport.last.url).toBe('/api/v1/nodes/node-a')
    })

    it('drops managedFields from what the editor is given', async () => {
        transport.answerWith(deployment())

        const object = await service.read(target)

        expect((object.metadata as Record<string, unknown>).managedFields).toBeUndefined()
        expect((object.metadata as Record<string, unknown>).name).toBe('api')
    })

    it('keeps every other field exactly as the cluster sent it', async () => {
        transport.answerWith(deployment({ extraField: { anything: true } }))

        const object = await service.read(target)

        expect(object.extraField).toEqual({ anything: true })
    })

    it('reports an answer with no object as a business error', async () => {
        transport.answerWith(undefined)

        await expect(service.read(target)).rejects.toBeInstanceOf(ApiError)
    })
})

describe('ResourceYamlService.apply', () => {
    beforeEach(() => {
        transport.reset()
        service = new ResourceYamlService(connectionService, new KubeObjectAdapter(contexts))
    })

    const applying = async (edited: Record<string, unknown>, kind = deployments) => {
        transport.answerWith({})
        transport.answerWith(deployment())

        return service.apply({ ...target, kind, current: deployment(), edited })
    }

    it('sends a narrow change as a PATCH of that field alone', async () => {
        await applying(deployment({ spec: { replicas: 5 } }))

        expect(transport.requests[0].method).toBe('PATCH')
        expect((transport.requests[0].body as Record<string, unknown>).spec).toEqual({ replicas: 5 })
    })

    it('carries the resourceVersion in every patch so a conflict is detectable', async () => {
        await applying(deployment({ spec: { replicas: 5 } }))

        const metadata = (transport.requests[0].body as Record<string, unknown>).metadata as Record<string, unknown>
        expect(metadata.resourceVersion).toBe('4011')
    })

    it('sends a deletion as a PUT of the whole object', async () => {
        const edited = deployment()
        delete (edited.metadata as Record<string, unknown>).labels

        await applying(edited)

        expect(transport.requests[0].method).toBe('PUT')
    })

    it('addresses the object by name whichever way it writes', async () => {
        await applying(deployment({ spec: { replicas: 5 } }))

        expect(transport.requests[0].url).toBe('/apis/apps/v1/namespaces/payments/deployments/api')
    })

    it('reads the object back so the editor shows what the cluster now holds', async () => {
        const result = await applying(deployment({ spec: { replicas: 5 } }))

        expect(transport.requests[1].method).toBe('GET')
        expect(result.object.metadata).toMatchObject({ name: 'api' })
    })

    it('sends nothing at all when the document means the same thing', async () => {
        const result = await service.apply({ ...target, current: deployment(), edited: deployment() })

        expect(transport.requests).toHaveLength(0)
        expect(result.plan.mode).toBe('noop')
    })

    it('lets a version conflict travel up as a 409', async () => {
        transport.failWith(new ApiError('The object has changed', 'Conflict', 409))

        await expect(service.apply({
            ...target,
            current: deployment(),
            edited: deployment({ spec: { replicas: 5 } }),
        })).rejects.toMatchObject({ status: 409 })
    })

    it('refuses a write that would drop a field this build cannot express', async () => {
        await expect(service.apply({
            ...target,
            kind: secrets,
            current: { apiVersion: 'v1', kind: 'Secret', metadata: { name: 's' }, data: {} },
            edited: { apiVersion: 'v1', kind: 'Secret', metadata: { name: 's' }, data: {}, stringData: { token: 'x' } },
        })).rejects.toMatchObject({ message: ResourceYamlService.cannotExpress })

        expect(transport.requests).toHaveLength(0)
    })
})

describe('ResourceYamlService.create', () => {
    beforeEach(() => {
        transport.reset()
        service = new ResourceYamlService(connectionService, new KubeObjectAdapter(contexts))
    })

    it('creates a kind the registry has never heard of through the generic set', async () => {
        transport.answerWith({ metadata: { name: 'widget-a', namespace: 'lab' } })

        const created = await service.create({
            clusterId: 'prod',
            kind: widgets,
            namespace: 'lab',
            document: { apiVersion: 'acme.example.com/v1', kind: 'Widget', metadata: { name: 'widget-a' }, spec: { size: 2 } },
        })

        expect(transport.last.method).toBe('POST')
        expect(transport.last.url).toBe('/apis/acme.example.com/v1/namespaces/lab/widgets')
        expect(created).toEqual({ name: 'widget-a', namespace: 'lab' })
    })

    it('lets the manifest name its own namespace over the selected one', async () => {
        transport.answerWith({ metadata: { name: 'widget-a', namespace: 'other' } })

        await service.create({
            clusterId: 'prod',
            kind: widgets,
            namespace: 'lab',
            document: { apiVersion: 'acme.example.com/v1', kind: 'Widget', metadata: { name: 'widget-a', namespace: 'other' } },
        })

        expect(transport.last.url).toBe('/apis/acme.example.com/v1/namespaces/other/widgets')
    })

    it('reports the name the cluster gave a generateName object', async () => {
        transport.answerWith({ metadata: { name: 'nightly-x7k2p', namespace: 'lab' } })

        const created = await service.create({
            clusterId: 'prod',
            kind: widgets,
            namespace: 'lab',
            document: { apiVersion: 'acme.example.com/v1', kind: 'Widget', metadata: { generateName: 'nightly-' } },
        })

        expect(created.name).toBe('nightly-x7k2p')
    })
})
