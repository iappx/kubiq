import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { TerminalBytes, TerminalKey } from '@/domain/models/terminal'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { TerminalStore } from '@/store/modules/terminal/TerminalStore'

// @InjectableStore resolves the store the moment its module is imported, so the double has
// to exist before that import — hence a hoisted module mock.
const fake = vi.hoisted(() => ({
    sessions: new Map<string, { kind: string, sink: any, request: any }>(),
    closed: [] as string[],
    written: [] as { key: string, text: string }[],
    resized: [] as { key: string, cols: number, rows: number }[],
    links: [] as string[],
    nodes: [] as string[],
    containers: [] as { name: string, isInit: boolean }[],
    refusal: null as Error | null,
}))

vi.mock('@/application/services/terminal/TerminalService', () => ({
    TerminalService: class {
        public async openExec(key: string, request: any, sink: any): Promise<void> {
            this.open('exec', key, request, sink)
        }

        public async openNodeShell(key: string, request: any, sink: any): Promise<void> {
            this.open('node', key, request, sink)
        }

        public async openLocalShell(key: string, request: any, sink: any): Promise<void> {
            this.open('local', key, request, sink)
        }

        public async write(key: string, data: Uint8Array): Promise<void> {
            fake.written.push({ key, text: new TextDecoder().decode(data) })
        }

        public async resize(key: string, cols: number, rows: number): Promise<void> {
            fake.resized.push({ key, cols, rows })
        }

        public attachView(): void {}

        public detachView(): void {}

        public has(key: string): boolean {
            return fake.sessions.has(key)
        }

        public async close(key: string): Promise<void> {
            fake.sessions.delete(key)
            fake.closed.push(key)
        }

        public async closeCluster(clusterId: string): Promise<void> {
            [...fake.sessions.keys()]
                .filter(key => key.startsWith(`term|${clusterId}|`))
                .forEach((key) => {
                    fake.sessions.delete(key)
                    fake.closed.push(key)
                })
        }

        public async closeAll(): Promise<void> {
            fake.sessions.forEach((_value, key) => fake.closed.push(key))
            fake.sessions.clear()
        }

        public async openLink(url: string): Promise<void> {
            fake.links.push(url)
        }

        public async listNodes(): Promise<string[]> {
            if (fake.refusal) {
                throw fake.refusal
            }
            return fake.nodes
        }

        public async containers(): Promise<{ name: string, isInit: boolean }[]> {
            return fake.containers
        }

        private open(kind: string, key: string, request: any, sink: any): void {
            if (fake.refusal) {
                throw fake.refusal
            }
            fake.sessions.set(key, { kind, sink, request })
        }
    },
}))

const store = container.resolve(TerminalStore)
const eventBus = container.resolve(EventBus)

const sinkOf = (key: string) => fake.sessions.get(key)!.sink

describe('TerminalStore', () => {
    beforeEach(() => {
        store.views = {}
        store.nodes = []
        fake.sessions.clear()
        fake.closed.length = 0
        fake.written.length = 0
        fake.resized.length = 0
        fake.links.length = 0
        fake.nodes = []
        fake.containers = []
        fake.refusal = null
    })

    it('opens an exec view keyed to its cluster', () => {
        const key = store.openExec('prod', 'payments', 'api-0', 'app')

        expect(TerminalKey.isTerminal(key)).toBe(true)
        expect(TerminalKey.clusterOf(key)).toBe('prod')
        expect(store.viewOf(key)?.kind).toBe('exec')
        expect(store.viewOf(key)?.title).toBe('api-0/app')
        expect(store.viewOf(key)?.state).toBe('starting')
    })

    it('gives every terminal a key of its own, even for the same pod', () => {
        const first = store.openExec('prod', 'payments', 'api-0', 'app')
        const second = store.openExec('prod', 'payments', 'api-0', 'app')

        expect(first).not.toBe(second)
        expect(Object.keys(store.views)).toHaveLength(2)
    })

    it('titles a node shell and a local shell for what they are', () => {
        const node = store.openNodeShell('prod', 'worker-1')
        const local = store.openLocalShell('prod', 'payments')

        expect(store.viewOf(node)?.title).toBe('node/worker-1')
        expect(store.viewOf(node)?.nodeName).toBe('worker-1')
        expect(store.viewOf(local)?.title).toBe('Shell: prod')
        expect(store.viewOf(local)?.namespace).toBe('payments')
    })

    it('passes the target through to the service', () => {
        const key = store.openExec('prod', 'payments', 'api-0', 'app')

        expect(fake.sessions.get(key)?.request).toEqual({
            clusterId: 'prod',
            namespace: 'payments',
            podName: 'api-0',
            containerName: 'app',
        })
    })

    it('follows the state the session reports', () => {
        const key = store.openExec('prod', 'payments', 'api-0', 'app')

        sinkOf(key).onState(key, 'running', '', 'none')
        expect(store.viewOf(key)?.state).toBe('running')

        sinkOf(key).onState(key, 'failed', 'no shell', 'kubectl')
        expect(store.viewOf(key)?.state).toBe('failed')
        expect(store.viewOf(key)?.failure).toBe('no shell')
        expect(store.viewOf(key)?.hint).toBe('kubectl')
    })

    it('sends input and the window size to the session', () => {
        const key = store.openExec('prod', 'payments', 'api-0', 'app')

        store.write(key, TerminalBytes.fromText('ls\r'))
        store.resize(key, 100, 30)

        expect(fake.written).toEqual([{ key, text: 'ls\r' }])
        expect(fake.resized).toEqual([{ key, cols: 100, rows: 30 }])
    })

    it('restarts a session with the target it already had', async () => {
        const key = store.openExec('prod', 'payments', 'api-0', 'app')
        sinkOf(key).onState(key, 'failed', 'gone', 'none')

        await store.restart(key)

        expect(store.viewOf(key)?.state).toBe('starting')
        expect(store.viewOf(key)?.failure).toBe('')
        expect(fake.sessions.get(key)?.request.podName).toBe('api-0')
    })

    it('drops the view and closes the session on close', async () => {
        const key = store.openExec('prod', 'payments', 'api-0', 'app')

        await store.close(key)

        expect(store.has(key)).toBe(false)
        expect(fake.closed).toEqual([key])
    })

    it('closes only the terminals of the cluster that went away', async () => {
        const prod = store.openExec('prod', 'payments', 'api-0', 'app')
        const stage = store.openExec('stage', 'web', 'nginx-0', 'nginx')

        await store.closeCluster('prod')

        expect(store.has(prod)).toBe(false)
        expect(store.has(stage)).toBe(true)
        expect(fake.closed).toEqual([prod])
    })

    it('reports a refusal as an application error rather than throwing', async () => {
        const seen: AppErrorEvent[] = []
        eventBus.registerHandler(AppErrorEvent, (event) => { seen.push(event) })
        fake.refusal = new ApiError('Could not open a channel to the cluster', 'forbidden')

        const key = store.openExec('prod', 'payments', 'api-0', 'app')
        await Promise.resolve()

        expect(seen).toHaveLength(1)
        expect(store.has(key)).toBe(true)
    })

    it('loads the nodes a node shell can be opened on', async () => {
        fake.nodes = ['control-1', 'worker-1']

        await store.loadNodes('prod')

        expect(store.nodes).toEqual(['control-1', 'worker-1'])
        expect(store.loadingNodes).toBe(false)
    })

    it('empties the node list and reports when it cannot be read', async () => {
        const seen: AppErrorEvent[] = []
        eventBus.registerHandler(AppErrorEvent, (event) => { seen.push(event) })
        fake.refusal = new ApiError('Could not list the nodes', 'forbidden')

        await store.loadNodes('prod')

        expect(store.nodes).toEqual([])
        expect(seen).toHaveLength(1)
    })

    it('loads the containers of the pod it is entering', async () => {
        fake.containers = [{ name: 'migrate', isInit: true }, { name: 'app', isInit: false }]

        const key = store.openExec('prod', 'payments', 'api-0', 'app')
        await store.loadContainers(key)

        expect(store.viewOf(key)?.containers).toHaveLength(2)
    })

    it('does not look for containers of a shell that has no pod', async () => {
        fake.containers = [{ name: 'app', isInit: false }]

        const key = store.openLocalShell('prod', 'payments')
        await store.loadContainers(key)

        expect(store.viewOf(key)?.containers).toEqual([])
    })

    it('restarts the session on the container that was picked', async () => {
        const key = store.openExec('prod', 'payments', 'api-0', '')

        await store.selectContainer(key, 'sidecar')

        expect(store.viewOf(key)?.containerName).toBe('sidecar')
        expect(store.viewOf(key)?.title).toBe('api-0/sidecar')
        expect(fake.sessions.get(key)?.request.containerName).toBe('sidecar')
    })

    it('does nothing when the container picked is the one already open', async () => {
        const key = store.openExec('prod', 'payments', 'api-0', 'app')
        fake.sessions.delete(key)

        await store.selectContainer(key, 'app')

        expect(fake.sessions.has(key)).toBe(false)
    })

    it('hands a link in the terminal to the host', () => {
        store.openLink('https://kubernetes.io/docs/tasks/tools/')

        expect(fake.links).toEqual(['https://kubernetes.io/docs/tasks/tools/'])
    })
})
