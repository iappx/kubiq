import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'
import { createPinia, setActivePinia } from 'pinia'
import { EntityRepo } from '@iappx/entity-repo'

// @InjectableStore builds the store the moment its module is imported, so the seams that
// reach the cluster are replaced above the imports rather than through the container after them.
const seam = vi.hoisted(() => ({
    transport: null as unknown,
    context: (() => undefined) as () => unknown,
}))

vi.mock('@/infrastructure/entityRepo/kube/KubeContextProvider', () => ({
    KubeContextProvider: class {
        public request(): unknown {
            return seam.transport
        }
    },
}))

vi.mock('@/application/services/cluster/ClusterConnectionService', () => ({
    ClusterConnectionService: class {
        public context(): unknown {
            return seam.context()
        }

        public connection(): unknown {
            return { clusterId: 'prod', sessionId: 'session-1' }
        }

        public get connections(): unknown[] {
            return [{ clusterId: 'prod', sessionId: 'session-1' }]
        }
    },
}))

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ResourceAppliedEvent } from '@/domain/events/cluster/ResourceAppliedEvent'
import { ResourceCreatedEvent } from '@/domain/events/cluster/ResourceCreatedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeManifest, KubeResourceRegistry } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { ResourceObjectStore } from '@/store/modules/resourceObject/ResourceObjectStore'
import { MemoryKubeTransport } from '../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()
seam.transport = transport
seam.context = () => EntityRepo.create().use(KubeEntityContext, transport as never).getContext(KubeEntityContext)

const deployments = KubeResourceRegistry.find('apps', 'deployments')!
const served = [deployments, KubeResourceRegistry.find('', 'services')!]

setActivePinia(createPinia())

const store = container.resolve(ResourceObjectStore)
const eventBus = container.resolve(EventBus)

const target = { clusterId: 'prod', kind: deployments, name: 'api', namespace: 'payments', served }

const deployment = (resourceVersion: string, replicas: number) => ({
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'api', namespace: 'payments', uid: 'd-1', resourceVersion },
    spec: { replicas },
    status: { readyReplicas: replicas },
})

const captured: unknown[] = []

const record = (event: unknown): void => {
    captured.push(event)
}

describe('ResourceObjectStore', () => {
    beforeEach(() => {
        transport.reset()
        store.objects = {}
        captured.length = 0
    })

    it('holds the object the cluster served, keyed by cluster, kind and name', async () => {
        transport.answerWith(deployment('4011', 3))
        transport.answerWith({ items: [] })

        await store.load(target)

        expect(store.stateOf(target).object).toMatchObject({ metadata: { name: 'api' } })
        expect(store.stateOf(target).loaded).toBe(true)
    })

    it('keeps its own copy of the refusal so the panel can write its own words', async () => {
        transport.failWith(new ApiError('Denied', 'Forbidden', 403))

        await store.load(target)

        expect(store.stateOf(target)).toMatchObject({ forbidden: true, loaded: false })
    })

    it('marks an object that is no longer there rather than calling it an error', async () => {
        transport.failWith(new ApiError('Not found', 'NotFound', 404))

        await store.load(target)

        expect(store.stateOf(target).missing).toBe(true)
    })

    it('shows the object even when its relations could not be read', async () => {
        transport.answerWith(deployment('4011', 3))
        transport.failWith(new ApiError('Denied', 'Forbidden', 403))

        await store.load(target)

        expect(store.stateOf(target).loaded).toBe(true)
        expect(store.stateOf(target).relations).toEqual([])
    })

    it('announces an applied change so a toast can name the object', async () => {
        eventBus.registerHandler(ResourceAppliedEvent, record)

        transport.answerWith(deployment('4011', 3))
        transport.answerWith({ items: [] })
        await store.load(target)

        transport.answerWith({})
        transport.answerWith(deployment('4012', 5))
        await store.apply(target, deployment('4011', 5))

        eventBus.unregisterHandler(ResourceAppliedEvent, record)
        expect(captured).toHaveLength(1)
        expect(captured[0]).toMatchObject({ name: 'api', replaced: false })
    })

    it('says nothing at all when the manifest means what it already meant', async () => {
        eventBus.registerHandler(ResourceAppliedEvent, record)

        transport.answerWith(deployment('4011', 3))
        transport.answerWith({ items: [] })
        await store.load(target)

        const result = await store.apply(target, deployment('4011', 3))

        eventBus.unregisterHandler(ResourceAppliedEvent, record)
        expect(result?.plan.mode).toBe('noop')
        expect(captured).toEqual([])
    })

    it('reads the cluster copy beside the draft instead of raising an error on 409', async () => {
        eventBus.registerHandler(AppErrorEvent, record)

        transport.answerWith(deployment('4011', 3))
        transport.answerWith({ items: [] })
        await store.load(target)

        transport.failWith(new ApiError('Changed', 'Conflict', 409))
        transport.answerWith(deployment('4099', 7))
        await store.apply(target, deployment('4011', 5))

        eventBus.unregisterHandler(AppErrorEvent, record)
        expect(KubeManifest.resourceVersionOf(store.stateOf(target).conflict)).toBe('4099')
        expect(captured).toEqual([])
    })

    it('raises anything that is not a conflict the usual way', async () => {
        eventBus.registerHandler(AppErrorEvent, record)

        transport.answerWith(deployment('4011', 3))
        transport.answerWith({ items: [] })
        await store.load(target)

        transport.failWith(new ApiError('Invalid', 'Invalid', 422))
        await store.apply(target, deployment('4011', 5))

        eventBus.unregisterHandler(AppErrorEvent, record)
        expect(captured).toHaveLength(1)
        expect(store.stateOf(target).conflict).toEqual({})
    })

    it('takes the cluster copy when the operator chooses theirs', async () => {
        transport.answerWith(deployment('4011', 3))
        transport.answerWith({ items: [] })
        await store.load(target)

        transport.failWith(new ApiError('Changed', 'Conflict', 409))
        transport.answerWith(deployment('4099', 7))
        await store.apply(target, deployment('4011', 5))

        store.takeConflict(target)

        expect(KubeManifest.resourceVersionOf(store.stateOf(target).object)).toBe('4099')
        expect(store.stateOf(target).conflict).toEqual({})
    })

    it('rebases a kept draft onto the version the cluster now holds', async () => {
        transport.answerWith(deployment('4011', 3))
        transport.answerWith({ items: [] })
        await store.load(target)

        transport.failWith(new ApiError('Changed', 'Conflict', 409))
        transport.answerWith(deployment('4099', 7))
        await store.apply(target, deployment('4011', 5))

        const rebased = store.rebase(target, deployment('4011', 5))

        expect(KubeManifest.resourceVersionOf(rebased)).toBe('4099')
        expect((rebased.spec as Record<string, unknown>).replicas).toBe(5)
    })

    it('drops the conflict when the operator goes back to editing', async () => {
        transport.answerWith(deployment('4011', 3))
        transport.answerWith({ items: [] })
        await store.load(target)

        transport.failWith(new ApiError('Changed', 'Conflict', 409))
        transport.answerWith(deployment('4099', 7))
        await store.apply(target, deployment('4011', 5))

        store.dismissConflict(target)

        expect(store.stateOf(target).conflict).toEqual({})
    })

    it('announces a created object and reports what it was called', async () => {
        eventBus.registerHandler(ResourceCreatedEvent, record)

        transport.answerWith({ metadata: { name: 'api', namespace: 'payments' } })
        const created = await store.create({
            clusterId: 'prod',
            kind: deployments,
            namespace: 'payments',
            document: deployment('', 1),
        })

        eventBus.unregisterHandler(ResourceCreatedEvent, record)
        expect(created).toEqual({ name: 'api', namespace: 'payments' })
        expect(captured).toHaveLength(1)
    })

    it('reports a refused creation through the error mechanism and answers with nothing', async () => {
        eventBus.registerHandler(AppErrorEvent, record)

        transport.failWith(new ApiError('Invalid', 'Invalid', 422))
        const created = await store.create({
            clusterId: 'prod',
            kind: deployments,
            namespace: 'payments',
            document: deployment('', 1),
        })

        eventBus.unregisterHandler(AppErrorEvent, record)
        expect(created).toBeNull()
        expect(captured).toHaveLength(1)
    })

    it('forgets everything of a cluster that was disconnected', async () => {
        transport.answerWith(deployment('4011', 3))
        transport.answerWith({ items: [] })
        await store.load(target)

        store.forget('prod')

        expect(store.stateOf(target).loaded).toBe(false)
    })
})
