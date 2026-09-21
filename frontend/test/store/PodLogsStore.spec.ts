import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { SuccessMessageEvent } from '@/domain/events/app/SuccessMessageEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { PodLogKey } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { PodLogsStore } from '@/store/modules/podLogs/PodLogsStore'

// @InjectableStore resolves the store the moment its module is imported, so the double has
// to exist before that import — hence a hoisted module mock.
const fake = vi.hoisted(() => {
    const sessions = new Map<string, { sink: any, lines: string[] }>()
    const closed: string[] = []

    return {
        sessions,
        closed,
        containers: [] as { name: string, isInit: boolean }[],
        refusal: null as Error | null,
        savedPath: 'userdata:logs/payments_api-0_app_20260921-143205.log',
        copyFailure: null as Error | null,
    }
})

vi.mock('@/application/services/podLogs/PodLogsService', () => ({
    PodLogsService: class {
        public async open(request: any, sink: any): Promise<void> {
            if (fake.refusal) {
                throw fake.refusal
            }
            fake.sessions.set(request.key, { sink, lines: [] })
        }

        public async close(key: string): Promise<void> {
            fake.sessions.delete(key)
            fake.closed.push(key)
        }

        public async closeCluster(clusterId: string): Promise<void> {
            [...fake.sessions.keys()]
                .filter(key => key.includes(`|${clusterId}|`))
                .forEach((key) => {
                    fake.sessions.delete(key)
                    fake.closed.push(key)
                })
        }

        public has(key: string): boolean {
            return fake.sessions.has(key)
        }

        public lines(key: string): readonly string[] {
            return fake.sessions.get(key)?.lines ?? []
        }

        public async containers(): Promise<{ name: string, isInit: boolean }[]> {
            return fake.containers
        }

        public async save(): Promise<string> {
            return fake.savedPath
        }

        public async copy(): Promise<void> {
            if (fake.copyFailure) {
                throw fake.copyFailure
            }
        }
    },
}))

const store = container.resolve(PodLogsStore)
const eventBus = container.resolve(EventBus)

const key = PodLogKey.of('prod', 'payments', 'api-0', 'app')

const sinkOf = (sessionKey: string) => fake.sessions.get(sessionKey)!.sink

describe('PodLogsStore', () => {
    beforeEach(() => {
        store.views = {}
        fake.sessions.clear()
        fake.closed.length = 0
        fake.containers = []
        fake.refusal = null
        fake.copyFailure = null
    })

    it('opens a view keyed by cluster, namespace, pod and container', async () => {
        const opened = await store.openPod('prod', 'payments', 'api-0', 'app', false)

        expect(opened).toBe(key)
        expect(store.has(key)).toBe(true)
        expect(store.viewOf(key)?.podName).toBe('api-0')
        expect(store.viewOf(key)?.options.container).toBe('app')
        expect(store.viewOf(key)?.options.follow).toBe(true)
    })

    it('opens the previous log without following it', async () => {
        await store.openPod('prod', 'payments', 'api-0', 'app', true)

        expect(store.viewOf(key)?.options.previous).toBe(true)
        expect(store.viewOf(key)?.options.follow).toBe(false)
    })

    it('loads the containers of the pod it opened', async () => {
        fake.containers = [{ name: 'migrate', isInit: true }, { name: 'app', isInit: false }]

        await store.openPod('prod', 'payments', 'api-0', 'app', false)

        expect(store.viewOf(key)?.containers).toHaveLength(2)
    })

    it('counts the lines the service reports', async () => {
        await store.openPod('prod', 'payments', 'api-0', 'app', false)

        sinkOf(key).onLines(key, 42, 7)

        expect(store.viewOf(key)?.lineCount).toBe(42)
        expect(store.viewOf(key)?.dropped).toBe(7)
        expect(store.viewOf(key)?.revision).toBeGreaterThan(0)
    })

    it('holds the restarted state the service reports', async () => {
        await store.openPod('prod', 'payments', 'api-0', 'app', false)

        sinkOf(key).onState(key, 'restarted', '')

        expect(store.viewOf(key)?.state).toBe('restarted')
        expect(store.has(key)).toBe(true)
    })

    it('reconnects a restarted stream by following the current container again', async () => {
        await store.openPod('prod', 'payments', 'api-0', 'app', true)

        await store.reconnect(key)

        expect(store.viewOf(key)?.options.previous).toBe(false)
        expect(store.viewOf(key)?.options.follow).toBe(true)
        expect(store.viewOf(key)?.state).toBe('connecting')
    })

    it('switches a restarted stream to the previous container on request', async () => {
        await store.openPod('prod', 'payments', 'api-0', 'app', false)

        await store.showPrevious(key)

        expect(store.viewOf(key)?.options.previous).toBe(true)
        expect(store.viewOf(key)?.options.follow).toBe(false)
    })

    it('starts the buffer over when the options change', async () => {
        await store.openPod('prod', 'payments', 'api-0', 'app', false)
        sinkOf(key).onLines(key, 42, 7)

        await store.applyOptions(key, { ...store.viewOf(key)!.options, timestamps: true })

        expect(store.viewOf(key)?.lineCount).toBe(0)
        expect(store.viewOf(key)?.dropped).toBe(0)
        expect(store.viewOf(key)?.autoscroll).toBe(true)
    })

    it('does nothing when the options would describe the same stream', async () => {
        await store.openPod('prod', 'payments', 'api-0', 'app', false)
        sinkOf(key).onState(key, 'streaming', '')

        await store.applyOptions(key, { ...store.viewOf(key)!.options })

        expect(store.viewOf(key)?.state).toBe('streaming')
    })

    it('closes a tab and stops what it was showing', async () => {
        await store.openPod('prod', 'payments', 'api-0', 'app', false)

        await store.close(key)

        expect(store.has(key)).toBe(false)
        expect(fake.closed).toContain(key)
    })

    it('closes every tab of a disconnected cluster and leaves the others alone', async () => {
        await store.openPod('prod', 'payments', 'api-0', 'app', false)
        await store.openPod('prod', 'payments', 'api-1', 'app', false)
        await store.openPod('lab', 'payments', 'api-0', 'app', false)

        await store.closeCluster('prod')

        expect(store.has(PodLogKey.of('prod', 'payments', 'api-0', 'app'))).toBe(false)
        expect(store.has(PodLogKey.of('prod', 'payments', 'api-1', 'app'))).toBe(false)
        expect(store.has(PodLogKey.of('lab', 'payments', 'api-0', 'app'))).toBe(true)
    })

    it('shows what the cluster said when the stream cannot be opened', async () => {
        fake.refusal = new ApiError('Could not open the stream', 'container "app" in pod "api-0" is waiting to start')

        const raised: unknown[] = []
        const listener = (event: AppErrorEvent): void => {
            raised.push(event)
        }
        eventBus.registerHandler(AppErrorEvent, listener)

        await store.openPod('prod', 'payments', 'api-0', 'app', false)

        eventBus.unregisterHandler(AppErrorEvent, listener)

        expect(store.viewOf(key)?.state).toBe('failed')
        expect(store.viewOf(key)?.failure).toBe('Could not open the stream')
        expect(raised).toHaveLength(1)
    })

    it('keeps the search, the wrap and the autoscroll of each tab', async () => {
        await store.openPod('prod', 'payments', 'api-0', 'app', false)

        store.setSearch(key, 'error')
        store.setOnlyMatches(key, true)
        store.setWrap(key, true)
        store.setShowContainer(key, true)
        store.setAutoscroll(key, false)

        expect(store.viewOf(key)).toMatchObject({
            search: 'error',
            onlyMatches: true,
            wrap: true,
            showContainer: true,
            autoscroll: false,
        })
    })

    it('says how much it saved', async () => {
        await store.openPod('prod', 'payments', 'api-0', 'app', false)
        sinkOf(key).onLines(key, 4312, 0)

        const messages: string[] = []
        const listener = (event: SuccessMessageEvent): void => {
            messages.push(event.content)
        }
        eventBus.registerHandler(SuccessMessageEvent, listener)

        await store.save(key)

        eventBus.unregisterHandler(SuccessMessageEvent, listener)

        expect(messages[0]).toContain('4,312 lines')
        expect(messages[0]).toContain('userdata:logs/')
    })

    it('reports a refused clipboard rather than pretending it copied', async () => {
        await store.openPod('prod', 'payments', 'api-0', 'app', false)
        fake.copyFailure = new ApiError('Could not copy to the clipboard', 'denied')

        const raised: unknown[] = []
        const listener = (event: AppErrorEvent): void => {
            raised.push(event)
        }
        eventBus.registerHandler(AppErrorEvent, listener)

        const copied = await store.copy(key)

        eventBus.unregisterHandler(AppErrorEvent, listener)

        expect(copied).toBe(false)
        expect(raised).toHaveLength(1)
    })
})
