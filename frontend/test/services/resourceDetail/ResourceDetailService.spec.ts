import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { ResourceDetailService } from '@/application/services/resourceDetail/ResourceDetailService'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import { ResourceYamlService } from '@/application/services/resourceYaml/ResourceYamlService'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { KubeObjectAdapter } from '@/infrastructure/kube/KubeObjectAdapter'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()

const pods = KubeResourceRegistry.find('', 'pods')!
const served = [
    pods,
    KubeResourceRegistry.find('apps', 'replicasets')!,
    KubeResourceRegistry.find('apps', 'deployments')!,
    KubeResourceRegistry.find('', 'services')!,
    KubeResourceRegistry.find('', 'persistentvolumeclaims')!,
]

const connectionService = {
    context: () => EntityRepo.create().use(KubeEntityContext, transport as never).getContext(KubeEntityContext),
    connection: () => ({ clusterId: 'prod', sessionId: 'session-1' }),
    connections: [{ clusterId: 'prod', sessionId: 'session-1' }],
} as unknown as ClusterConnectionService

const contexts = { request: () => transport } as unknown as KubeContextProvider

const pod = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
        name: 'api-7d9-abcde',
        namespace: 'payments',
        uid: 'p-1',
        labels: { app: 'api' },
        ownerReferences: [{ apiVersion: 'apps/v1', kind: 'ReplicaSet', name: 'api-7d9', uid: 'rs-1', controller: true }],
    },
    spec: { volumes: [{ name: 'data', persistentVolumeClaim: { claimName: 'api-data' } }] },
}

const replicaSet = {
    apiVersion: 'apps/v1',
    kind: 'ReplicaSet',
    metadata: {
        name: 'api-7d9',
        namespace: 'payments',
        uid: 'rs-1',
        ownerReferences: [{ apiVersion: 'apps/v1', kind: 'Deployment', name: 'api', uid: 'd-1', controller: true }],
    },
}

const deployment = { apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name: 'api', namespace: 'payments', uid: 'd-1' } }

let service: ResourceDetailService

const request = { clusterId: 'prod', kind: pods, object: pod, served }

describe('ResourceDetailService.owners', () => {
    beforeEach(() => {
        transport.reset()
        const yamlService = new ResourceYamlService(connectionService, new KubeObjectAdapter(contexts))
        service = new ResourceDetailService(yamlService, new ResourceListService(connectionService))
    })

    it('walks pod to ReplicaSet to Deployment', async () => {
        transport.answerWith(replicaSet)
        transport.answerWith(deployment)

        const owners = await service.owners(request)

        expect(owners.map(owner => `${owner.kindName}/${owner.name}`)).toEqual([
            'ReplicaSet/api-7d9',
            'Deployment/api',
        ])
    })

    it('still offers the first owner when the cluster refuses to read it', async () => {
        transport.failWith(new ApiError('Denied', 'Forbidden', 403))

        const owners = await service.owners(request)

        expect(owners).toHaveLength(1)
        expect(owners[0]).toMatchObject({ kindName: 'ReplicaSet', name: 'api-7d9' })
    })

    it('finds no owner for an object nothing controls', async () => {
        expect(await service.owners({ ...request, object: deployment })).toEqual([])
    })

    it('stops rather than looping when the references form a cycle', async () => {
        const looping = { ...replicaSet, metadata: { ...replicaSet.metadata, ownerReferences: pod.metadata.ownerReferences } }
        transport.answerWith(looping)

        const owners = await service.owners(request)

        expect(owners).toHaveLength(1)
    })

    it('resolves the owner to a kind so the row can open it', async () => {
        transport.answerWith(replicaSet)
        transport.answerWith(deployment)

        const owners = await service.owners(request)

        expect(owners[0].kind?.resource).toBe('replicasets')
    })
})

describe('ResourceDetailService.services', () => {
    beforeEach(() => {
        transport.reset()
        const yamlService = new ResourceYamlService(connectionService, new KubeObjectAdapter(contexts))
        service = new ResourceDetailService(yamlService, new ResourceListService(connectionService))
    })

    const serviceList = {
        items: [
            { metadata: { uid: 's-1', name: 'api', namespace: 'payments' }, spec: { selector: { app: 'api' }, ports: [{ port: 80 }] } },
            { metadata: { uid: 's-2', name: 'ledger', namespace: 'payments' }, spec: { selector: { app: 'ledger' } } },
            { metadata: { uid: 's-3', name: 'headless', namespace: 'payments' }, spec: {} },
        ],
    }

    it('names only the services whose selector matches the pod', async () => {
        transport.answerWith(serviceList)

        const found = await service.services(request)

        expect(found.map(item => item.name)).toEqual(['api'])
    })

    it('scopes the list to the pod namespace rather than reading the cluster', async () => {
        transport.answerWith(serviceList)

        await service.services(request)

        expect(transport.last.url).toBe('/api/v1/namespaces/payments/services')
    })

    it('asks for nothing at all for a kind that is not a pod', async () => {
        const found = await service.services({ ...request, kind: served[2], object: deployment })

        expect(found).toEqual([])
        expect(transport.requests).toHaveLength(0)
    })

    it('says nothing rather than failing when the services cannot be listed', async () => {
        transport.failWith(new ApiError('Denied', 'Forbidden', 403))

        expect(await service.services(request)).toEqual([])
    })
})

describe('ResourceDetailService.claims', () => {
    it('offers every claim the pod mounts as a link', () => {
        expect(ResourceDetailService.claims(request)).toEqual([{
            key: 'claim/payments/api-data',
            kindName: 'PersistentVolumeClaim',
            name: 'api-data',
            namespace: 'payments',
            kind: served[4],
            detail: '',
        }])
    })

    it('offers none for something that is not a pod', () => {
        expect(ResourceDetailService.claims({ ...request, kind: served[2], object: deployment })).toEqual([])
    })
})

describe('ResourceDetailService.relations', () => {
    beforeEach(() => {
        transport.reset()
        const yamlService = new ResourceYamlService(connectionService, new KubeObjectAdapter(contexts))
        service = new ResourceDetailService(yamlService, new ResourceListService(connectionService))
    })

    it('leaves out a group with nothing in it', async () => {
        transport.answerWith(replicaSet)
        transport.answerWith({ items: [] })
        transport.answerWith(deployment)

        const groups = await service.relations(request)

        expect(groups.map(group => group.title)).not.toContain(ResourceDetailService.servicesTitle)
        expect(groups.map(group => group.title)).toContain(ResourceDetailService.claimsTitle)
    })
})
