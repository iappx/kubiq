import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { RestEntityQuery, RestUrlError } from '@iappx/entity-repo-rest'
import { KubeResourceKind, KubeResourceRegistry } from '@/domain/models/kube'
import { KubeQueryMeta } from '@/infrastructure/entityRepo/kube/KubeQueryMeta'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'
import { TestKubeContext } from '../../support/TestKubeContext'
import { TestPodEntity } from '../../support/TestPodEntity'

const transport = new MemoryKubeTransport()
const context = EntityRepo.create().use(TestKubeContext, transport).getContext(TestKubeContext)

const kindOf = (group: string, resource: string): KubeResourceKind =>
    KubeResourceRegistry.find(group, resource) as KubeResourceKind

const of = (group: string, resource: string): RestEntityQuery<TestPodEntity> =>
    context.resources.withMeta(KubeQueryMeta.forKind(kindOf(group, resource)))

describe('KubeUrlBuilder', () => {
    beforeEach(() => {
        transport.reset()
    })

    it('lists a core group resource across every namespace', async () => {
        await of('', 'pods').getAll()

        expect(transport.path).toBe('/api/v1/pods')
    })

    it('lists a core group resource inside a namespace', async () => {
        await of('', 'pods').withPathParams({ namespace: 'dev' }).getAll()

        expect(transport.path).toBe('/api/v1/namespaces/dev/pods')
    })

    it('lists a named group resource inside a namespace', async () => {
        await of('apps', 'deployments').withPathParams({ namespace: 'dev' }).getAll()

        expect(transport.path).toBe('/apis/apps/v1/namespaces/dev/deployments')
    })

    it('leaves the namespace out of a cluster scoped resource', async () => {
        await of('', 'nodes').withPathParams({ namespace: 'dev' }).getAll()

        expect(transport.path).toBe('/api/v1/nodes')
    })

    it('addresses a single object by name, not by primary key', async () => {
        transport.answerWith({ metadata: { uid: 'uid-1', name: 'web-1' } })

        await of('', 'pods').withPathParams({ namespace: 'dev', name: 'web-1' }).getOne('uid-1')

        expect(transport.path).toBe('/api/v1/namespaces/dev/pods/web-1')
    })

    it('reaches a subresource of a single object', async () => {
        await of('', 'pods').withPathParams({ namespace: 'dev', name: 'web-1', subresource: 'log' }).getOne('uid-1')

        expect(transport.path).toBe('/api/v1/namespaces/dev/pods/web-1/log')
    })

    it('hangs a created subresource off the named object, not off the collection', async () => {
        const eviction = TestPodEntity.build({ uid: 'uid-1', metadata: { uid: 'uid-1', name: 'web-1' } })

        await of('', 'pods')
            .withPathParams({ namespace: 'dev', name: 'web-1', subresource: 'eviction' })
            .create(eviction)

        expect(transport.path).toBe('/api/v1/namespaces/dev/pods/web-1/eviction')
    })

    it('still posts to the collection when no subresource is named', async () => {
        const pod = TestPodEntity.build({ uid: 'uid-1', metadata: { uid: 'uid-1', name: 'web-1' } })

        await of('', 'pods').withPathParams({ namespace: 'dev', name: 'web-1' }).create(pod)

        expect(transport.path).toBe('/api/v1/namespaces/dev/pods')
    })

    it('takes the address from the object when a write carries it', async () => {
        const pod = TestPodEntity.build({
            uid: 'uid-1',
            metadata: { uid: 'uid-1', name: 'web-1', namespace: 'dev' },
            spec: { nodeName: 'node-a' },
        })

        await context.pods.update(pod)

        expect(transport.path).toBe('/api/v1/namespaces/dev/pods/web-1')
    })

    it('refuses to address a single object without a name', async () => {
        await expect(of('', 'pods').getOne('uid-1')).rejects.toThrow(RestUrlError)
        expect(transport.requests).toHaveLength(0)
    })

    it('refuses a query that carries no resource kind', async () => {
        await expect(context.resources.getAll()).rejects.toThrow(RestUrlError)
        expect(transport.requests).toHaveLength(0)
    })
})
