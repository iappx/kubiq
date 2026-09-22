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

import { ResourceDetailService } from '@/application/services/resourceDetail/ResourceDetailService'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ResourceAppliedEvent } from '@/domain/events/cluster/ResourceAppliedEvent'
import { ResourceCreatedEvent } from '@/domain/events/cluster/ResourceCreatedEvent'
import { SuccessMessageEvent } from '@/domain/events/app/SuccessMessageEvent'
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

const pods = KubeResourceRegistry.find('', 'pods')!
const podServed = [pods, KubeResourceRegistry.find('', 'secrets')!]

const clipboardWrites: string[] = []

Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
        writeText: async (text: string) => {
            clipboardWrites.push(text)
        },
    },
})

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
        expect(store.stateOf(target).relationsLoading).toBe(false)
    })

    it('says the relations are still coming while it reads them', async () => {
        let readingWhileFlagged = false
        const relations = vi.spyOn(ResourceDetailService.prototype, 'relations').mockImplementation(() => {
            readingWhileFlagged = store.stateOf(target).relationsLoading

            return Promise.resolve([])
        })

        transport.answerWith(deployment('4011', 3))
        await store.load(target)
        relations.mockRestore()

        expect(readingWhileFlagged).toBe(true)
        expect(store.stateOf(target).relationsLoading).toBe(false)
    })

    it('stops saying so even when the relations were refused', async () => {
        const relations = vi.spyOn(ResourceDetailService.prototype, 'relations')
            .mockRejectedValue(new ApiError('Denied', 'Forbidden', 403))

        transport.answerWith(deployment('4011', 3))
        await store.load(target)
        relations.mockRestore()

        expect(store.stateOf(target).relationsLoading).toBe(false)
    })

    it('reads the events once when a second load is asked for while one is running', async () => {
        transport.answerWith(deployment('4011', 3))
        transport.answerWith({ items: [] })
        await store.load(target)

        transport.reset()
        transport.answerWith({ items: [], metadata: { resourceVersion: '5000' } })
        transport.answerWith({ items: [], metadata: { resourceVersion: '5000' } })

        await Promise.all([store.loadEvents(target), store.loadEvents(target)])

        expect(transport.requests).toHaveLength(1)
        expect(store.stateOf(target).eventsLoaded).toBe(true)
        expect(store.stateOf(target).eventsLoading).toBe(false)
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

describe('ResourceObjectStore environment', () => {
    const podTarget = { clusterId: 'prod', kind: pods, name: 'api-7d9-abcde', namespace: 'payments', served: podServed }

    // No labels and no owner, so loading the pod itself costs exactly one read.
    const pod = {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'api-7d9-abcde', namespace: 'payments', uid: 'p-1', resourceVersion: '5' },
        spec: {
            containers: [{
                name: 'api',
                env: [
                    { name: 'LOG_LEVEL', value: 'debug' },
                    { name: 'DB_PASSWORD', valueFrom: { secretKeyRef: { name: 'db-creds', key: 'password' } } },
                ],
            }],
        },
    }

    const dbCreds = {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name: 'db-creds', namespace: 'payments' },
        data: { password: btoa('placeholder-value') },
    }

    const loadPod = async (): Promise<void> => {
        transport.answerWith(pod)
        await store.load(podTarget)
    }

    beforeEach(() => {
        transport.reset()
        store.objects = {}
        captured.length = 0
        clipboardWrites.length = 0
    })

    it('holds one group per container once the references have been read', async () => {
        await loadPod()
        transport.answerWith(dbCreds)

        await store.loadEnvironment(podTarget)

        const state = store.stateOf(podTarget)
        expect(state.environment.map(group => group.container)).toEqual(['api'])
        expect(state.environmentLoaded).toBe(true)
        expect(state.environmentLoading).toBe(false)
        expect(state.environmentError).toBe('')
    })

    it('resolves a secret reference into a value the panel can mask', async () => {
        await loadPod()
        transport.answerWith(dbCreds)

        await store.loadEnvironment(podTarget)

        expect(store.stateOf(podTarget).environment[0].entries[1]).toMatchObject({
            variable: 'DB_PASSWORD',
            masked: true,
            state: 'resolved',
        })
    })

    it('keeps its own copy of the failure instead of leaving the tab blank', async () => {
        await loadPod()
        transport.failWith(new ApiError('Broken', 'InternalError', 500))

        await store.loadEnvironment(podTarget)

        expect(store.stateOf(podTarget).environmentError).toBe('Broken')
        expect(store.stateOf(podTarget).environmentLoading).toBe(false)
    })

    it('reads the references once when a second load is asked for while one is running', async () => {
        await loadPod()
        transport.reset()
        transport.answerWith(dbCreds)
        transport.answerWith(dbCreds)

        await Promise.all([store.loadEnvironment(podTarget), store.loadEnvironment(podTarget)])

        expect(transport.requests).toHaveLength(1)
    })

    it('copies a masked value and names the variable without repeating the value', async () => {
        eventBus.registerHandler(SuccessMessageEvent, record)
        await loadPod()
        transport.answerWith(dbCreds)
        await store.loadEnvironment(podTarget)
        const secret = store.stateOf(podTarget).environment[0].entries[1]

        const done = await store.copyEnvironmentEntry(podTarget, secret.id)

        eventBus.unregisterHandler(SuccessMessageEvent, record)
        expect(done).toBe(true)
        expect(clipboardWrites).toEqual(['placeholder-value'])
        expect(captured).toHaveLength(1)
        expect((captured[0] as SuccessMessageEvent).content).toBe(
            'Copied the secret value of DB_PASSWORD to the clipboard',
        )
    })

    it('says that copying a whole container took the secret values with it', async () => {
        eventBus.registerHandler(SuccessMessageEvent, record)
        await loadPod()
        transport.answerWith(dbCreds)
        await store.loadEnvironment(podTarget)

        const done = await store.copyEnvironmentGroup(podTarget, 'api')

        eventBus.unregisterHandler(SuccessMessageEvent, record)
        expect(done).toBe(true)
        expect(clipboardWrites).toEqual(['LOG_LEVEL=debug\nDB_PASSWORD=placeholder-value'])
        expect((captured[0] as SuccessMessageEvent).content).toBe(
            'Copied 2 variables of api to the clipboard, secret values included',
        )
    })

    it('answers with nothing at all when asked to copy something it does not hold', async () => {
        expect(await store.copyEnvironmentEntry(podTarget, 'api/0/GONE')).toBe(false)
        expect(await store.copyEnvironmentGroup(podTarget, 'gone')).toBe(false)
        expect(clipboardWrites).toEqual([])
    })
})
