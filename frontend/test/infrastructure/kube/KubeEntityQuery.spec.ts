import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { KubePatchRequestFactory } from '@/infrastructure/entityRepo/kube/strategies/KubePatchRequestFactory'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'
import { TestKubeContext } from '../../support/TestKubeContext'
import { TestPodEntity } from '../../support/TestPodEntity'

const transport = new MemoryKubeTransport()
const context = EntityRepo.create().use(TestKubeContext, transport).getContext(TestKubeContext)

const pod = (name: string, uid: string): Record<string, unknown> => ({
    metadata: { uid, name, namespace: 'dev', resourceVersion: '12' },
    spec: { nodeName: 'node-a' },
    status: { phase: 'Running' },
})

const list = (items: Record<string, unknown>[], token: string = '', remaining?: number): Record<string, unknown> => ({
    apiVersion: 'v1',
    kind: 'PodList',
    metadata: remaining === undefined
        ? { resourceVersion: '77', continue: token }
        : { resourceVersion: '77', continue: token, remainingItemCount: remaining },
    items,
})

describe('KubeEntityQuery', () => {
    beforeEach(() => {
        transport.reset()
    })

    it('asks for a page with a limit', async () => {
        transport.answerWith(list([]))

        await context.pods.take(50).getPage()

        expect(transport.last.query).toEqual({ limit: 50 })
    })

    it('asks for the next page with the continue token', async () => {
        transport.answerWith(list([]))

        await context.pods.take(50).after('token-2').getPage()

        expect(transport.last.query).toEqual({ limit: 50, continue: 'token-2' })
    })

    it('reports the continue token of an unfinished list as the cursor', async () => {
        transport.answerWith(list([pod('web-1', 'uid-1')], 'token-2', 120))

        const page = await context.pods.take(1).getPage()

        expect(page.cursor).toEqual({ end: 'token-2', hasNext: true })
        expect(page.total).toBe(121)
    })

    it('reports the end of the list when the continue token is empty', async () => {
        transport.answerWith(list([pod('web-1', 'uid-1')]))

        const page = await context.pods.getPage()

        expect(page.cursor).toEqual({ hasNext: false })
        expect(page.total).toBeUndefined()
    })

    it('builds an entity per item and lifts the uid out of the metadata', async () => {
        transport.answerWith(list([pod('web-1', 'uid-1'), pod('web-2', 'uid-2')]))

        const pods = await context.pods.getAll()

        expect(pods.map(p => p.uid)).toEqual(['uid-1', 'uid-2'])
        expect(pods.map(p => p.getPkValue())).toEqual(['uid-1', 'uid-2'])
        expect(pods[0].metadata.name).toBe('web-1')
    })

    it('completes an item with the apiVersion and kind a list element does not carry', async () => {
        transport.answerWith(list([pod('web-1', 'uid-1')]))

        const [first] = await context.pods.getAll()

        expect(first.apiVersion).toBe('v1')
        expect(first.kind).toBe('Pod')
    })

    it('reads an empty answer as an empty collection', async () => {
        await expect(context.pods.getAll()).resolves.toEqual([])
    })

    it('patches an object with the changed fields and the merge patch content type', async () => {
        const entity = TestPodEntity.build(pod('web-1', 'uid-1'))
        entity.spec = { nodeName: 'node-b' }
        transport.answerWith({ ...pod('web-1', 'uid-1'), spec: { nodeName: 'node-b' } })

        await context.pods.withPathParams({ namespace: 'dev', name: 'web-1' }).patch(entity)

        expect(transport.last.method).toBe('PATCH')
        expect(transport.last.url).toBe('/api/v1/namespaces/dev/pods/web-1')
        expect(transport.last.headers?.['content-type']).toBe(KubePatchRequestFactory.mergePatchType)
        expect(transport.last.body).toEqual({ spec: { nodeName: 'node-b' } })
    })

    it('creates an object from the serialised entity, without the client side key', async () => {
        const entity = TestPodEntity.build(pod('web-1', 'uid-1'))
        transport.answerWith(pod('web-1', 'uid-1'))

        await context.pods.create(entity)

        expect(transport.last.method).toBe('POST')
        expect(transport.last.url).toBe('/api/v1/namespaces/dev/pods')
        expect(transport.last.body).toEqual({
            metadata: { uid: 'uid-1', name: 'web-1', namespace: 'dev', resourceVersion: '12' },
            spec: { nodeName: 'node-a' },
            status: { phase: 'Running' },
        })
    })

    it('deletes an object addressed by name', async () => {
        await context.pods.withPathParams({ namespace: 'dev', name: 'web-1' }).delete('uid-1')

        expect(transport.last.method).toBe('DELETE')
        expect(transport.last.url).toBe('/api/v1/namespaces/dev/pods/web-1')
    })

    it('serves the entities of the domain layer as well as its own', async () => {
        transport.answerWith(list([pod('web-1', 'uid-1')]))

        const pods = await context.domainPods.where(f => f.opPath('eq', ['status', 'phase'], 'Running')).getAll()

        expect(pods[0].uid).toBe('uid-1')
        expect(pods[0].name).toBe('web-1')
        expect(pods[0].namespace).toBe('dev')
        expect(pods[0].phase).toBe('Running')
        expect(transport.last.query).toEqual({ fieldSelector: 'status.phase=Running' })
    })
})
