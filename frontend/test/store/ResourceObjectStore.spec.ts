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

describe('ResourceObjectStore data copying', () => {
    const secretTarget = {
        clusterId: 'prod',
        kind: KubeResourceRegistry.find('', 'secrets')!,
        name: 'app-creds',
        namespace: 'payments',
        served: podServed,
    }
    const configMapTarget = { ...secretTarget, kind: KubeResourceRegistry.find('', 'configmaps')!, name: 'app-config' }

    beforeEach(() => {
        captured.length = 0
        clipboardWrites.length = 0
    })

    it('copies one value and names the key, not the value', async () => {
        eventBus.registerHandler(SuccessMessageEvent, record)

        const done = await store.copyDataValue(secretTarget, { key: 'password', value: 'placeholder-value' })

        eventBus.unregisterHandler(SuccessMessageEvent, record)
        expect(done).toBe(true)
        expect(clipboardWrites).toEqual(['placeholder-value'])
        expect((captured[0] as SuccessMessageEvent).content).toBe('Copied the decoded value of password to the clipboard')
    })

    it('copies a config map as YAML and says how many keys went', async () => {
        eventBus.registerHandler(SuccessMessageEvent, record)

        const done = await store.copyDataMap(configMapTarget, [
            { key: 'level', value: 'debug' },
            { key: 'app.conf', value: 'a=1\nb=2\n' },
        ])

        eventBus.unregisterHandler(SuccessMessageEvent, record)
        expect(done).toBe(true)
        expect(clipboardWrites).toEqual(['level: debug\napp.conf: |\n  a=1\n  b=2\n'])
        expect((captured[0] as SuccessMessageEvent).content).toBe('Copied 2 keys of app-config as YAML')
    })

    it('says that copying a secret took the decoded values with it', async () => {
        eventBus.registerHandler(SuccessMessageEvent, record)

        await store.copyDataMap(secretTarget, [{ key: 'password', value: 'placeholder-value' }])

        eventBus.unregisterHandler(SuccessMessageEvent, record)
        expect((captured[0] as SuccessMessageEvent).content).toBe('Copied 1 key of app-creds as YAML, secret values decoded')
    })

    it('copies nothing when there is nothing to copy', async () => {
        expect(await store.copyDataMap(configMapTarget, [])).toBe(false)
        expect(clipboardWrites).toEqual([])
    })

    it('raises the clipboard failure instead of claiming a copy', async () => {
        eventBus.registerHandler(AppErrorEvent, record)
        const clipboard = navigator.clipboard
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })

        const done = await store.copyDataValue(configMapTarget, { key: 'level', value: 'debug' })

        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
        eventBus.unregisterHandler(AppErrorEvent, record)
        expect(done).toBe(false)
        expect(captured[0]).toBeInstanceOf(AppErrorEvent)
    })
})

describe('ResourceObjectStore data editing', () => {
    const configMaps = KubeResourceRegistry.find('', 'configmaps')!
    const secrets = KubeResourceRegistry.find('', 'secrets')!
    const configMapTarget = {
        clusterId: 'prod',
        kind: configMaps,
        name: 'app-config',
        namespace: 'payments',
        served: [configMaps, secrets],
    }
    const secretTarget = {
        clusterId: 'prod',
        kind: secrets,
        name: 'app-creds',
        namespace: 'payments',
        served: [configMaps, secrets],
    }

    const configMapDoc = (resourceVersion: string, data: Record<string, string>) => ({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: 'app-config', namespace: 'payments', uid: 'cm-1', resourceVersion },
        data,
    })

    const secretDoc = (resourceVersion: string, data: Record<string, string>) => ({
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name: 'app-creds', namespace: 'payments', uid: 'sec-1', resourceVersion },
        type: 'Opaque',
        data,
    })

    beforeEach(() => {
        transport.reset()
        store.objects = {}
        captured.length = 0
    })

    it('saves a ConfigMap key via patch and emits ResourceAppliedEvent', async () => {
        eventBus.registerHandler(ResourceAppliedEvent, record)

        transport.answerWith(configMapDoc('10', { level: 'info' }))
        await store.load(configMapTarget)
        transport.reset()

        transport.answerWith({})
        transport.answerWith(configMapDoc('11', { level: 'debug', mode: 'fast' }))
        const saved = await store.saveDataEntry(configMapTarget, { key: 'mode', value: 'fast' })

        eventBus.unregisterHandler(ResourceAppliedEvent, record)
        expect(saved).toBe(true)
        expect(transport.requests[0].method).toBe('PATCH')
        expect(transport.requests[0].body).toMatchObject({ data: { level: 'info', mode: 'fast' } })
        expect(store.stateOf(configMapTarget).object).toMatchObject({ data: { level: 'debug', mode: 'fast' } })
        expect(captured).toHaveLength(1)
        expect(captured[0]).toMatchObject({ kindName: 'ConfigMap', name: 'app-config', replaced: false })
    })

    it('encodes Secret values as UTF-8 base64 and never emits the value in events', async () => {
        eventBus.registerHandler(ResourceAppliedEvent, record)

        transport.answerWith(secretDoc('20', { existing: 'a2VlcA==' }))
        await store.load(secretTarget)
        transport.reset()

        const sampleText = 'utf8-пример'
        const encoded = 'dXRmOC3Qv9GA0LjQvNC10YA='
        transport.answerWith({})
        transport.answerWith(secretDoc('21', { existing: 'a2VlcA==', greeting: encoded }))

        const saved = await store.saveDataEntry(secretTarget, { key: 'greeting', value: sampleText })

        eventBus.unregisterHandler(ResourceAppliedEvent, record)
        expect(saved).toBe(true)
        expect(transport.requests[0].method).toBe('PATCH')
        expect(transport.requests[0].body).toMatchObject({ data: { existing: 'a2VlcA==', greeting: encoded } })
        expect(captured).toHaveLength(1)
        expect(JSON.stringify(captured)).not.toContain(sampleText)
        expect(JSON.stringify(captured)).not.toContain(encoded)
    })

    it('renames a Secret key via replace and drops the old key', async () => {
        eventBus.registerHandler(ResourceAppliedEvent, record)

        transport.answerWith(secretDoc('25', { oldKey: 'b2xk', keep: 'a2VlcA==' }))
        await store.load(secretTarget)
        transport.reset()

        transport.answerWith({})
        transport.answerWith(secretDoc('26', { keep: 'a2VlcA==', newKey: 'bmV3' }))

        const saved = await store.saveDataEntry(secretTarget, {
            key: 'newKey',
            value: 'new',
            originalKey: 'oldKey',
        })

        eventBus.unregisterHandler(ResourceAppliedEvent, record)
        expect(saved).toBe(true)
        expect(transport.requests[0].method).toBe('PUT')
        expect((transport.requests[0].body as Record<string, unknown>).data).toEqual({
            keep: 'a2VlcA==',
            newKey: 'bmV3',
        })
        expect(captured[0]).toMatchObject({ kindName: 'Secret', name: 'app-creds', replaced: true })
    })

    it('removes a key via replace and updates the stored object', async () => {
        eventBus.registerHandler(ResourceAppliedEvent, record)

        transport.answerWith(configMapDoc('30', { a: '1', b: '2' }))
        await store.load(configMapTarget)
        transport.reset()

        transport.answerWith({})
        transport.answerWith(configMapDoc('31', { b: '2' }))

        const removed = await store.removeDataEntry(configMapTarget, 'a')

        eventBus.unregisterHandler(ResourceAppliedEvent, record)
        expect(removed).toBe(true)
        expect(transport.requests[0].method).toBe('PUT')
        expect((transport.requests[0].body as Record<string, unknown>).data).toEqual({ b: '2' })
        expect(store.stateOf(configMapTarget).object).toMatchObject({ data: { b: '2' } })
        expect(captured[0]).toMatchObject({ kindName: 'ConfigMap', name: 'app-config', replaced: true })
    })

    it('refreshes the object, clears conflict, and raises AppErrorEvent on 409 during saveDataEntry without leaking secret values', async () => {
        eventBus.registerHandler(AppErrorEvent, record)

        const freshPlain = 'fresh-cluster-value'
        const freshEncoded = btoa(freshPlain)
        const draftPlain = 'local-draft-value'
        const draftEncoded = btoa(draftPlain)

        transport.answerWith(secretDoc('40', { token: btoa('old-value') }))
        await store.load(secretTarget)
        transport.reset()

        transport.failWith(new ApiError('Conflict', 'Conflict', 409))
        transport.answerWith(secretDoc('41', { token: freshEncoded }))

        const saved = await store.saveDataEntry(secretTarget, { key: 'token', value: draftPlain, originalKey: 'token' })

        eventBus.unregisterHandler(AppErrorEvent, record)
        expect(saved).toBe(false)
        expect(KubeManifest.resourceVersionOf(store.stateOf(secretTarget).object)).toBe('41')
        expect(store.stateOf(secretTarget).object).toMatchObject({ data: { token: freshEncoded } })
        expect(store.stateOf(secretTarget).conflict).toEqual({})
        expect(captured).toHaveLength(1)
        expect(captured[0]).toBeInstanceOf(AppErrorEvent)
        const event = captured[0] as AppErrorEvent
        expect(event.context).toBe('ResourceObjectStore.saveDataEntry')
        expect(event.error).toBeInstanceOf(ApiError)
        expect((event.error as ApiError).message).toBe('Object was modified on the cluster')
        expect((event.error as ApiError).details).toBe('The latest version has been loaded — review the keys and try again.')
        expect(JSON.stringify(captured)).not.toContain(freshPlain)
        expect(JSON.stringify(captured)).not.toContain(freshEncoded)
        expect(JSON.stringify(captured)).not.toContain(draftPlain)
        expect(JSON.stringify(captured)).not.toContain(draftEncoded)
    })

    it('refreshes the object, clears conflict, and raises AppErrorEvent on 409 during removeDataEntry', async () => {
        eventBus.registerHandler(AppErrorEvent, record)

        const freshPlain = 'retained-secret-value'
        const freshEncoded = btoa(freshPlain)

        transport.answerWith(secretDoc('45', { a: btoa('one'), b: btoa('two') }))
        await store.load(secretTarget)
        transport.reset()

        transport.failWith(new ApiError('Conflict', 'Conflict', 409))
        transport.answerWith(secretDoc('46', { a: freshEncoded, b: btoa('two') }))

        const removed = await store.removeDataEntry(secretTarget, 'a')

        eventBus.unregisterHandler(AppErrorEvent, record)
        expect(removed).toBe(false)
        expect(KubeManifest.resourceVersionOf(store.stateOf(secretTarget).object)).toBe('46')
        expect(store.stateOf(secretTarget).object).toMatchObject({ data: { a: freshEncoded, b: btoa('two') } })
        expect(store.stateOf(secretTarget).conflict).toEqual({})
        expect(captured).toHaveLength(1)
        expect(captured[0]).toBeInstanceOf(AppErrorEvent)
        const event = captured[0] as AppErrorEvent
        expect(event.context).toBe('ResourceObjectStore.removeDataEntry')
        expect(event.error).toBeInstanceOf(ApiError)
        expect((event.error as ApiError).message).toBe('Object was modified on the cluster')
        expect(JSON.stringify(captured)).not.toContain(freshPlain)
        expect(JSON.stringify(captured)).not.toContain(freshEncoded)
    })

    it('returns false and raises AppErrorEvent when removeDataEntry fails', async () => {
        eventBus.registerHandler(AppErrorEvent, record)

        transport.answerWith(configMapDoc('50', { a: '1' }))
        await store.load(configMapTarget)
        transport.reset()

        transport.failWith(new ApiError('Forbidden', 'Forbidden', 403))

        const removed = await store.removeDataEntry(configMapTarget, 'a')

        eventBus.unregisterHandler(AppErrorEvent, record)
        expect(removed).toBe(false)
        expect(captured).toHaveLength(1)
        expect(captured[0]).toBeInstanceOf(AppErrorEvent)
    })
})
