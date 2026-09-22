import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { PortForwardStartedEvent } from '@/domain/events/terminal/PortForwardStartedEvent'
import { PortForwardStoppedEvent } from '@/domain/events/terminal/PortForwardStoppedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'

// @InjectableStore resolves the store the moment its module is imported, so the double has
// to exist before that import — hence a hoisted module mock.
const fake = vi.hoisted(() => ({
    forwards: new Map<string, any>(),
    sink: null as any,
    stopped: [] as string[],
    opened: [] as string[],
    ports: [] as { port: number, name: string }[],
    names: [] as string[],
    refusal: null as Error | null,
    sequence: 0,
}))

vi.mock('@/application/services/portForward/PortForwardService', () => ({
    PortForwardService: class {
        public async start(request: any, sink: any): Promise<TPortForward> {
            if (fake.refusal) {
                throw fake.refusal
            }

            fake.sink = sink
            fake.sequence += 1

            const forward: TPortForward = {
                forwardId: `forward-${fake.sequence}`,
                clusterId: request.clusterId,
                namespace: request.namespace,
                resource: request.resource,
                name: request.name,
                label: `pod/${request.name}:${request.remotePort}`,
                podName: request.name,
                remotePort: request.remotePort,
                targetPort: request.remotePort,
                localPort: request.localPort === 0 ? 40000 + fake.sequence : request.localPort,
                address: '127.0.0.1',
                state: 'active',
                failure: '',
            }
            fake.forwards.set(forward.forwardId, forward)

            return forward
        }

        public async stop(forwardId: string): Promise<TPortForward | null> {
            const forward = fake.forwards.get(forwardId) ?? null
            fake.forwards.delete(forwardId)
            fake.stopped.push(forwardId)

            return forward
        }

        public async closeCluster(): Promise<TPortForward[]> {
            return []
        }

        public async closeAll(): Promise<void> {
            fake.forwards.clear()
        }

        public async open(forwardId: string): Promise<void> {
            if (fake.refusal) {
                throw fake.refusal
            }
            fake.opened.push(forwardId)
        }

        public async ports(): Promise<{ port: number, name: string }[]> {
            if (fake.refusal) {
                throw fake.refusal
            }
            return fake.ports
        }

        public async names(): Promise<string[]> {
            if (fake.refusal) {
                throw fake.refusal
            }
            return fake.names
        }

        public urlOf(forward: TPortForward): string {
            return `http://${forward.address}:${forward.localPort}`
        }
    },
}))

const store = container.resolve(PortForwardStore)
const eventBus = container.resolve(EventBus)

const request = (overrides: Record<string, unknown> = {}) => ({
    clusterId: 'prod',
    namespace: 'payments',
    resource: 'pods',
    name: 'api-0',
    remotePort: 8080,
    localPort: 0,
    ...overrides,
}) as never

describe('PortForwardStore', () => {
    beforeEach(() => {
        store.forwards = []
        store.ports = []
        store.names = []
        store.target = null
        fake.forwards.clear()
        fake.stopped.length = 0
        fake.opened.length = 0
        fake.ports = []
        fake.names = []
        fake.refusal = null
        fake.sequence = 0
    })

    it('lists what it started, per cluster', async () => {
        await store.start(request())
        await store.start(request({ clusterId: 'stage', name: 'nginx-0' }))

        expect(store.forwards).toHaveLength(2)
        expect(store.forwardsOf('prod').map(forward => forward.name)).toEqual(['api-0'])
        expect(store.forwardsOf('stage').map(forward => forward.name)).toEqual(['nginx-0'])
    })

    it('announces a forward that started', async () => {
        const seen: PortForwardStartedEvent[] = []
        eventBus.registerHandler(PortForwardStartedEvent, (event) => { seen.push(event) })

        await store.start(request())

        expect(seen).toHaveLength(1)
        expect(seen[0].label).toBe('pod/api-0:8080')
        expect(seen[0].localPort).toBe(40001)
    })

    it('announces a forward that was stopped and drops it from the list', async () => {
        const seen: PortForwardStoppedEvent[] = []
        eventBus.registerHandler(PortForwardStoppedEvent, (event) => { seen.push(event) })

        await store.start(request())
        await store.stop('forward-1')

        expect(store.forwards).toHaveLength(0)
        expect(seen).toHaveLength(1)
        expect(fake.stopped).toEqual(['forward-1'])
    })

    it('does not throw outwards when a forward is refused', async () => {
        const seen: AppErrorEvent[] = []
        eventBus.registerHandler(AppErrorEvent, (event) => { seen.push(event) })
        fake.refusal = new ApiError('Could not start the port forward', 'address in use')

        const started = await store.start(request())

        expect(started).toBe(false)
        expect(store.forwards).toHaveLength(0)
        expect(seen).toHaveLength(1)
        expect(store.starting).toBe(false)
    })

    it('shows a forward that later failed, without dropping it', async () => {
        await store.start(request())

        fake.sink.onForwardChanged({ ...fake.forwards.get('forward-1'), state: 'failed', failure: 'connection reset' })

        expect(store.forwards).toHaveLength(1)
        expect(store.forwards[0].state).toBe('failed')
        expect(store.forwards[0].failure).toBe('connection reset')
    })

    it('drops a forward the listener closed by itself', async () => {
        await store.start(request())

        fake.sink.onForwardClosed('forward-1')

        expect(store.forwards).toHaveLength(0)
    })

    it('opens the forwarded address', async () => {
        await store.start(request())
        await store.open('forward-1')

        expect(fake.opened).toEqual(['forward-1'])
    })

    it('loads the ports of the target it was pointed at', async () => {
        fake.ports = [{ port: 8080, name: 'http' }]

        await store.setTarget({
            clusterId: 'prod',
            namespace: 'payments',
            resource: 'services',
            name: 'api',
            remotePort: 8080,
        })

        expect(store.target?.name).toBe('api')
        expect(store.ports).toEqual([{ port: 8080, name: 'http' }])
    })

    it('forgets the target and its ports when told to', async () => {
        fake.ports = [{ port: 8080, name: 'http' }]
        await store.setTarget({
            clusterId: 'prod', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080,
        })

        await store.setTarget(null)

        expect(store.target).toBeNull()
        expect(store.ports).toEqual([])
    })

    it('offers the names of the namespace it was asked about', async () => {
        fake.names = ['api-0', 'web-2']

        await store.loadNames('prod', 'payments', 'pods')

        expect(store.names).toEqual(['api-0', 'web-2'])
    })

    it('raises a refused name list and offers nothing', async () => {
        const seen: AppErrorEvent[] = []
        eventBus.registerHandler(AppErrorEvent, (event) => { seen.push(event) })
        fake.names = ['api-0']
        fake.refusal = new ApiError('You cannot list pods in that namespace')

        await store.loadNames('prod', 'payments', 'pods')

        expect(store.names).toEqual([])
        expect(seen).toHaveLength(1)
    })

    it('clears its list for a cluster that went away', async () => {
        await store.start(request())
        await store.start(request({ clusterId: 'stage', name: 'nginx-0' }))

        await store.closeCluster('prod')

        expect(store.forwardsOf('prod')).toHaveLength(0)
        expect(store.forwardsOf('stage')).toHaveLength(1)
    })
})
