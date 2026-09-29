import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { SuccessMessageEvent } from '@/domain/events/app/SuccessMessageEvent'
import { PortForwardStartedEvent } from '@/domain/events/terminal/PortForwardStartedEvent'
import { PortForwardStoppedEvent } from '@/domain/events/terminal/PortForwardStoppedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'

// @InjectableStore resolves the store the moment its module is imported, so the doubles have
// to exist before that import — hence hoisted module mocks.
const fake = vi.hoisted(() => ({
    records: [] as any[],
    connected: new Set<string>(),
    started: [] as any[],
    stopped: [] as string[],
    stoppedClusters: [] as string[],
    removed: [] as string[],
    remembered: [] as { id: string, port: number }[],
    rememberedStops: [] as { id: string, isStoppedByUser: boolean }[],
    connects: [] as string[],
    opened: [] as string[],
    copied: [] as string[],
    clipboardRefusal: null as Error | null,
    refusal: null as Error | null,
    boundPort: 40001,
    gate: null as Promise<void> | null,
    reachable: true,
    sequence: 0,
    portsOf: {} as Record<string, any[]>,
    slowPorts: {} as Record<string, Promise<void> | undefined>,
    portCalls: [] as string[],
    namesOf: {} as Record<string, string[]>,
}))

vi.mock('@/application/services/portForward/PortForwardService', () => ({
    PortForwardService: class {
        public async list(): Promise<any[]> {
            return fake.records.map(record => ({ ...record }))
        }

        public async create(request: any, now: number): Promise<any> {
            fake.sequence += 1
            const record = {
                id: `pf-${fake.sequence}`,
                clusterId: request.clusterId,
                namespace: request.namespace,
                resource: request.resource,
                name: request.name,
                remotePort: request.remotePort,
                localPort: request.localPort,
                lastLocalPort: 0,
                restoreMode: request.restoreMode ?? 'onConnect',
                isStoppedByUser: false,
                createdAt: now,
                label: `pod/${request.name}:${request.remotePort}`,
                status: 'stopped',
                error: '',
                boundPort: 0,
                podName: '',
                targetPort: 0,
            }
            fake.records.push(record)

            return { ...record }
        }

        public async update(id: string, change: any): Promise<any> {
            const record = fake.records.find(open => open.id === id)
            Object.keys(change).forEach((key) => {
                if (change[key] !== undefined) {
                    record[key] = change[key]
                }
            })

            return { ...record, status: 'stopped', error: '', boundPort: 0, podName: '', targetPort: 0 }
        }

        public async remove(id: string): Promise<void> {
            fake.removed.push(id)
            fake.records = fake.records.filter(open => open.id !== id)
        }

        public async rememberPort(id: string, port: number): Promise<void> {
            fake.remembered.push({ id, port })
        }

        public async rememberStopped(id: string, isStoppedByUser: boolean): Promise<void> {
            fake.rememberedStops.push({ id, isStoppedByUser })
            const saved = fake.records.find(open => open.id === id)
            if (saved) {
                saved.isStoppedByUser = isStoppedByUser
            }
        }

        public isConnected(clusterId: string): boolean {
            return fake.connected.has(clusterId)
        }

        public async start(forward: any): Promise<any> {
            if (fake.gate) {
                await fake.gate
            }
            if (fake.refusal) {
                throw fake.refusal
            }

            fake.started.push({ ...forward })

            return {
                status: 'active',
                error: '',
                boundPort: forward.localPort || fake.boundPort,
                podName: forward.name,
                targetPort: 8080,
            }
        }

        public async stop(id: string): Promise<boolean> {
            fake.stopped.push(id)
            return true
        }

        public async stopCluster(clusterId: string): Promise<string[]> {
            fake.stoppedClusters.push(clusterId)
            return []
        }

        public async stopAll(): Promise<void> {}

        public async open(forward: any): Promise<void> {
            fake.opened.push(forward.id)
        }

        public async copyAddress(forward: any): Promise<string> {
            if (fake.clipboardRefusal) {
                throw fake.clipboardRefusal
            }

            const port = forward.boundPort || forward.localPort || forward.lastLocalPort
            if (!port) {
                return ''
            }

            fake.copied.push(forward.id)

            return `127.0.0.1:${port}`
        }

        public async ports(clusterId: string, namespace: string, resource: string, name: string): Promise<any[]> {
            fake.portCalls.push(`${clusterId}/${namespace}/${resource}/${name}`)
            await fake.slowPorts[name]
            if (fake.refusal) {
                throw fake.refusal
            }

            return (fake.portsOf[name] ?? []).map(port => ({ ...port }))
        }

        public async names(clusterId: string, namespace: string): Promise<string[]> {
            return [...(fake.namesOf[namespace] ?? [])]
        }
    },
}))

vi.mock('@/application/services/clusterEntry/ClusterEntryService', () => ({
    ClusterEntryService: class {
        public async connectInBackground(clusterId: string): Promise<boolean> {
            fake.connects.push(clusterId)
            if (fake.reachable) {
                fake.connected.add(clusterId)
            }

            return fake.reachable
        }
    },
}))

const store = container.resolve(PortForwardStore)
const eventBus = container.resolve(EventBus)

const record = (overrides: Partial<TPortForward> = {}): TPortForward => ({
    id: 'pf-1',
    clusterId: 'prod',
    namespace: 'payments',
    resource: 'services',
    name: 'api',
    remotePort: 8080,
    localPort: 0,
    lastLocalPort: 0,
    restoreMode: 'onConnect',
    isStoppedByUser: false,
    createdAt: 1,
    label: 'svc/api:8080',
    status: 'waiting',
    error: '',
    boundPort: 0,
    podName: '',
    targetPort: 0,
    ...overrides,
})

const request = (overrides: Record<string, unknown> = {}) => ({
    clusterId: 'prod',
    namespace: 'payments',
    resource: 'pods',
    name: 'api-0',
    remotePort: 8080,
    localPort: 0,
    ...overrides,
}) as never

const statusOf = (id: string): string | undefined => store.find(id)?.status

const seen = <T>(type: new (...args: any[]) => T): T[] => {
    const events: T[] = []
    eventBus.registerHandler(type, (event: T) => { events.push(event) })
    return events
}

describe('PortForwardStore', () => {
    beforeEach(() => {
        store.forwards = []
        store.loaded = false
        store.loading = false
        store.starting = false
        fake.records = []
        fake.connected = new Set(['prod'])
        fake.started.length = 0
        fake.stopped.length = 0
        fake.stoppedClusters.length = 0
        fake.removed.length = 0
        fake.remembered.length = 0
        fake.rememberedStops.length = 0
        fake.connects.length = 0
        fake.opened.length = 0
        fake.copied.length = 0
        fake.clipboardRefusal = null
        fake.refusal = null
        fake.boundPort = 40001
        fake.gate = null
        fake.reachable = true
        fake.sequence = 0
        fake.portsOf = {}
        fake.slowPorts = {}
        fake.portCalls.length = 0
        fake.namesOf = {}
        store.clearPorts()
        store.names = []
    })

    describe('restoring', () => {
        it('holds the forwards of every cluster in one list', async () => {
            fake.records = [record(), record({ id: 'pf-2', clusterId: 'stage', name: 'web' })]

            await store.load()

            expect(store.forwards.map(forward => forward.clusterId)).toEqual(['prod', 'stage'])
            expect(store.clusterIds).toEqual(['prod', 'stage'])
            expect(store.forwardsOf('stage').map(forward => forward.name)).toEqual(['web'])
        })

        it('starts what waits on a connected cluster and leaves the rest waiting', async () => {
            fake.records = [record(), record({ id: 'pf-2', clusterId: 'stage' })]

            await store.load()

            expect(fake.started.map(forward => forward.id)).toEqual(['pf-1'])
            expect(statusOf('pf-1')).toBe('active')
            expect(statusOf('pf-2')).toBe('waiting')
        })

        it('does not raise a toast for what it restores on its own', async () => {
            const started = seen(PortForwardStartedEvent)
            fake.records = [record()]

            await store.load()

            expect(started).toHaveLength(0)
        })

        it('leaves a manual forward stopped', async () => {
            fake.records = [record({ restoreMode: 'manual', status: 'stopped' })]

            await store.load()

            expect(fake.started).toHaveLength(0)
            expect(statusOf('pf-1')).toBe('stopped')
        })

        it('connects the clusters whose forwards ask for it on start', async () => {
            fake.connected = new Set()
            fake.records = [
                record({ restoreMode: 'connectOnStart' }),
                record({ id: 'pf-2', clusterId: 'stage', restoreMode: 'onConnect' }),
                record({ id: 'pf-3', clusterId: 'lab', restoreMode: 'manual', status: 'stopped' }),
            ]

            await store.restore()

            expect(fake.connects).toEqual(['prod'])
        })

        it('starts the waiting forwards of a cluster once it connects', async () => {
            fake.connected = new Set()
            fake.records = [record(), record({ id: 'pf-2', restoreMode: 'manual', status: 'stopped' })]
            await store.load()

            fake.connected.add('prod')
            await store.onClusterConnected('prod')

            expect(fake.started.map(forward => forward.id)).toEqual(['pf-1'])
            expect(statusOf('pf-1')).toBe('active')
            expect(statusOf('pf-2')).toBe('stopped')
        })

        it('remembers the port a forward got, so the next start asks for it again', async () => {
            fake.records = [record()]

            await store.load()

            expect(fake.remembered).toEqual([{ id: 'pf-1', port: 40001 }])
            expect(store.find('pf-1')?.lastLocalPort).toBe(40001)
        })

        it('does not rewrite a port that did not change', async () => {
            fake.records = [record({ lastLocalPort: 40001 })]

            await store.load()

            expect(fake.remembered).toHaveLength(0)
        })

        it('shows a forward that could not be restored as an error, without a toast', async () => {
            const errors = seen(AppErrorEvent)
            fake.refusal = new ApiError('No running pod stands behind that service')
            fake.records = [record()]

            await store.load()

            expect(statusOf('pf-1')).toBe('error')
            expect(store.find('pf-1')?.error).toBe('No running pod stands behind that service')
            expect(errors).toHaveLength(0)
        })
    })

    describe('a cluster that disconnects', () => {
        it('parks its forwards as its restore modes say, and keeps them', async () => {
            fake.records = [
                record(),
                record({ id: 'pf-2', restoreMode: 'manual', status: 'stopped' }),
                record({ id: 'pf-3', clusterId: 'stage' }),
            ]
            await store.load()
            await store.start('pf-2')

            await store.onClusterDisconnected('prod')

            expect(fake.stoppedClusters).toEqual(['prod'])
            expect(statusOf('pf-1')).toBe('waiting')
            expect(statusOf('pf-2')).toBe('stopped')
            expect(statusOf('pf-3')).toBe('waiting')
            expect(store.find('pf-1')?.boundPort).toBe(0)
            expect(store.forwards).toHaveLength(3)
        })

        it('keeps a forward the user stopped stopped', async () => {
            fake.records = [record()]
            await store.load()
            await store.stop('pf-1')

            await store.onClusterDisconnected('prod')

            expect(statusOf('pf-1')).toBe('stopped')
        })
    })

    describe('creating', () => {
        it('saves the forward, starts it and says where it listens', async () => {
            const started = seen(PortForwardStartedEvent)

            const created = await store.create(request())

            expect(created?.status).toBe('active')
            expect(created?.boundPort).toBe(40001)
            expect(fake.records).toHaveLength(1)
            expect(started).toHaveLength(1)
            expect(started[0].localPort).toBe(40001)
            expect(store.starting).toBe(false)
        })

        it('reuses a forward to the same port instead of adding a second', async () => {
            await store.create(request())
            await store.stop('pf-1')

            await store.create(request({ remotePort: '8080', localPort: 18080 }))

            expect(store.forwards).toHaveLength(1)
            expect(store.find('pf-1')?.localPort).toBe(18080)
            expect(statusOf('pf-1')).toBe('active')
        })

        it('keeps a forward that failed to start on screen with the reason, and says so', async () => {
            const errors = seen(AppErrorEvent)
            fake.refusal = new ApiError('Could not start the port forward', 'address in use')

            const created = await store.create(request())

            expect(created?.status).toBe('error')
            expect(created?.error).toBe('Could not start the port forward: address in use')
            expect(errors).toHaveLength(1)
        })
    })

    describe('editing', () => {
        it('restarts a running forward whose port changed', async () => {
            await store.create(request())

            await store.update('pf-1', { localPort: 18080 })

            expect(fake.started).toHaveLength(2)
            expect(fake.started[1].localPort).toBe(18080)
            expect(store.find('pf-1')?.boundPort).toBe(18080)
        })

        it('does not restart for a change of restore mode alone', async () => {
            await store.create(request())

            await store.update('pf-1', { restoreMode: 'manual' })

            expect(fake.started).toHaveLength(1)
            expect(store.find('pf-1')?.restoreMode).toBe('manual')
            expect(statusOf('pf-1')).toBe('active')
        })

        it('does not start a stopped forward because its port changed', async () => {
            await store.create(request())
            await store.stop('pf-1')

            await store.update('pf-1', { remotePort: 9090 })

            expect(fake.started).toHaveLength(1)
            expect(statusOf('pf-1')).toBe('stopped')
        })

        it('stops waiting when the mode no longer restores', async () => {
            fake.connected = new Set()
            fake.records = [record()]
            await store.load()

            await store.update('pf-1', { restoreMode: 'manual' })

            expect(statusOf('pf-1')).toBe('stopped')
        })
    })

    describe('starting and stopping', () => {
        it('connects the cluster of a forward started while it is away', async () => {
            fake.connected = new Set()
            fake.records = [record({ restoreMode: 'manual', status: 'stopped' })]
            await store.load()

            await store.start('pf-1')

            expect(fake.connects).toEqual(['prod'])
            expect(statusOf('pf-1')).toBe('waiting')

            await store.onClusterConnected('prod')

            expect(statusOf('pf-1')).toBe('active')
        })

        it('marks the forward failed when its cluster cannot be reached', async () => {
            fake.connected = new Set()
            fake.reachable = false
            fake.records = [record({ restoreMode: 'manual', status: 'stopped' })]
            await store.load()

            await store.start('pf-1')

            expect(statusOf('pf-1')).toBe('error')
            expect(store.find('pf-1')?.error).toBe(PortForwardStore.unreachable)
        })

        it('stops a forward and keeps it listed', async () => {
            const stopped = seen(PortForwardStoppedEvent)
            await store.create(request())

            await store.stop('pf-1')

            expect(statusOf('pf-1')).toBe('stopped')
            expect(store.forwards).toHaveLength(1)
            expect(fake.stopped).toEqual(['pf-1'])
            expect(stopped).toHaveLength(1)
        })

        it('drops the listener it got when the forward was stopped while opening', async () => {
            let open!: () => void
            fake.gate = new Promise<void>((resolve) => { open = resolve })
            fake.records = [record({ restoreMode: 'manual', status: 'stopped' })]
            await store.load()

            const starting = store.start('pf-1')
            expect(statusOf('pf-1')).toBe('starting')

            await store.stop('pf-1')
            open()
            await starting

            expect(statusOf('pf-1')).toBe('stopped')
            expect(fake.stopped).toEqual(['pf-1', 'pf-1'])
        })

        it('remembers a stop, so the forward stays stopped after a restart', async () => {
            fake.connected = new Set()
            fake.records = [record({ restoreMode: 'connectOnStart' })]
            await store.load()

            await store.stop('pf-1')

            expect(fake.rememberedStops).toEqual([{ id: 'pf-1', isStoppedByUser: true }])
            expect(store.find('pf-1')?.isStoppedByUser).toBe(true)

            store.forwards = []
            store.loaded = false
            fake.records = [record({ restoreMode: 'connectOnStart', isStoppedByUser: true, status: 'stopped' })]
            await store.restore()
            fake.connected.add('prod')
            await store.onClusterConnected('prod')

            expect(fake.connects).toHaveLength(0)
            expect(fake.started).toHaveLength(0)
            expect(statusOf('pf-1')).toBe('stopped')
        })

        it('forgets the stop once the user starts the forward again', async () => {
            fake.records = [record({ isStoppedByUser: true, status: 'stopped' })]
            await store.load()

            await store.start('pf-1')

            expect(fake.rememberedStops).toEqual([{ id: 'pf-1', isStoppedByUser: false }])
            expect(store.find('pf-1')?.isStoppedByUser).toBe(false)
            expect(statusOf('pf-1')).toBe('active')
        })

        it('keeps a stop pressed while the forward was still opening', async () => {
            let open!: () => void
            fake.gate = new Promise<void>((resolve) => { open = resolve })
            fake.records = [record({ isStoppedByUser: true, status: 'stopped' })]
            await store.load()

            const starting = store.start('pf-1')
            await store.stop('pf-1')
            open()
            await starting

            expect(store.find('pf-1')?.isStoppedByUser).toBe(true)
            expect(fake.records[0].isStoppedByUser).toBe(true)
        })

        it('does not remember a cluster going away as a stop', async () => {
            fake.records = [record()]
            await store.load()

            await store.onClusterDisconnected('prod')

            expect(fake.rememberedStops).toHaveLength(0)
            expect(statusOf('pf-1')).toBe('waiting')
        })

        it('removes a forward for good', async () => {
            await store.create(request())

            await store.remove('pf-1')

            expect(store.forwards).toHaveLength(0)
            expect(fake.removed).toEqual(['pf-1'])
        })

        it('opens the address of a forward', async () => {
            await store.create(request())

            await store.open('pf-1')

            expect(fake.opened).toEqual(['pf-1'])
        })
    })

    describe('copying the address', () => {
        it('copies the address of a forward and says so', async () => {
            const messages = seen(SuccessMessageEvent)
            fake.records = [record({ status: 'stopped', lastLocalPort: 18080 })]
            await store.load()

            expect(await store.copyAddress('pf-1')).toBe(true)

            expect(fake.copied).toEqual(['pf-1'])
            expect(messages.map(message => message.content)).toEqual(['Copied 127.0.0.1:18080 to the clipboard'])
        })

        it('copies nothing for a forward that never had a port', async () => {
            const messages = seen(SuccessMessageEvent)
            fake.records = [record({ status: 'stopped' })]
            await store.load()

            expect(await store.copyAddress('pf-1')).toBe(false)
            expect(await store.copyAddress('missing')).toBe(false)

            expect(messages).toHaveLength(0)
        })

        it('reports a refused clipboard', async () => {
            const errors = seen(AppErrorEvent)
            fake.clipboardRefusal = new ApiError('Could not copy to the clipboard', 'denied')
            fake.records = [record({ status: 'stopped', localPort: 18080 })]
            await store.load()

            expect(await store.copyAddress('pf-1')).toBe(false)

            expect(errors).toHaveLength(1)
        })
    })

    describe('what the service reports', () => {
        it('shows a forward that is looking for a new pod', async () => {
            await store.create(request())

            store.onForwardChanged('pf-1', {
                status: 'reconnecting', error: 'No running pod', boundPort: 40001, podName: 'api-0', targetPort: 8080,
            })

            expect(statusOf('pf-1')).toBe('reconnecting')
            expect(store.hasProblems).toBe(true)
            expect(store.activeCount).toBe(1)
        })

        it('ignores a late report about a forward that was stopped', async () => {
            await store.create(request())
            await store.stop('pf-1')

            store.onForwardChanged('pf-1', { status: 'error', error: 'dropped', boundPort: 0, podName: '', targetPort: 0 })

            expect(statusOf('pf-1')).toBe('stopped')
        })
    })

    describe('lookups', () => {
        it('finds a forward by its target, whether the port is a number or text', async () => {
            fake.connected = new Set()
            fake.records = [record(), record({ id: 'pf-2', remotePort: 'metrics' })]
            await store.load()

            expect(store.findFor('prod', 'payments', 'services', 'api', '8080')?.id).toBe('pf-1')
            expect(store.findFor('prod', 'payments', 'services', 'api', 'metrics')?.id).toBe('pf-2')
            expect(store.findFor('stage', 'payments', 'services', 'api', 8080)).toBeUndefined()
        })

        it('finds the forward of a declared port whether it was made by number or by name', async () => {
            fake.connected = new Set()
            fake.records = [record(), record({ id: 'pf-2', remotePort: 'metrics' })]
            await store.load()

            const find = (port: number, name: string) => store.findForPort('prod', 'payments', 'services', 'api', {
                port, name, protocol: 'TCP',
            })?.id

            expect(find(8080, 'http')).toBe('pf-1')
            expect(find(9090, 'metrics')).toBe('pf-2')
            expect(find(9090, '')).toBeUndefined()
            expect(find(7070, 'grpc')).toBeUndefined()
        })

        it('prefers the forward made by number when a port has both', async () => {
            fake.connected = new Set()
            fake.records = [record({ id: 'pf-2', remotePort: 'http' }), record()]
            await store.load()

            expect(store.findForPort('prod', 'payments', 'services', 'api', { port: 8080, name: 'http', protocol: 'TCP' })?.id)
                .toBe('pf-1')
        })

        it('finds the service forwards that run through a pod', async () => {
            fake.records = [record()]
            await store.load()
            store.onForwardChanged('pf-1', { status: 'active', error: '', boundPort: 40001, podName: 'api-7d5', targetPort: 9090 })

            expect(store.throughPod('prod', 'payments', 'api-7d5').map(forward => forward.id)).toEqual(['pf-1'])
            expect(store.throughPod('prod', 'payments', 'api-other')).toHaveLength(0)
        })

        it('gives the local address even of a forward that is not running', async () => {
            fake.connected = new Set()
            fake.records = [record({ lastLocalPort: 40007 })]
            await store.load()

            expect(store.addressOf(store.forwards[0])).toBe('127.0.0.1:40007')
            expect(store.urlOf(store.forwards[0])).toBe('http://127.0.0.1:40007')
        })

        it('names the remote ports other forwards of a target already use', async () => {
            fake.connected = new Set()
            fake.records = [
                record(),
                record({ id: 'pf-2', remotePort: 'metrics' }),
                record({ id: 'pf-3', name: 'web', remotePort: 80 }),
                record({ id: 'pf-4', clusterId: 'stage', remotePort: 9090 }),
            ]
            await store.load()

            expect(store.remotePortsOn('prod', 'payments', 'services', 'api')).toEqual([8080, 'metrics'])
            expect(store.remotePortsOn('prod', 'payments', 'services', 'api', 'pf-1')).toEqual(['metrics'])
        })
    })

    describe('what the form offers', () => {
        const tcp = { port: 8080, name: 'http', protocol: 'TCP' }

        it('reads the ports a target declares', async () => {
            fake.portsOf = { api: [tcp] }

            await store.loadPorts('prod', 'payments', 'services', 'api')

            expect(store.ports).toEqual([tcp])
            expect(store.loadingPorts).toBe(false)
        })

        it('does not ask a cluster that is not connected, and raises nothing', async () => {
            fake.connected = new Set()
            fake.portsOf = { api: [tcp] }
            const errors = seen(AppErrorEvent)

            await store.loadPorts('prod', 'payments', 'services', 'api')
            await store.loadNames('prod', 'payments', 'services')

            expect(fake.portCalls).toHaveLength(0)
            expect(store.ports).toEqual([])
            expect(store.names).toEqual([])
            expect(errors).toHaveLength(0)
        })

        it('does not ask before it knows which object to ask about', async () => {
            await store.loadPorts('prod', 'payments', 'services', '')

            expect(fake.portCalls).toHaveLength(0)
        })

        it('keeps the answer for the latest target when an older one arrives late', async () => {
            let release!: () => void
            fake.slowPorts = { old: new Promise<void>((resolve) => { release = resolve }) }
            fake.portsOf = { old: [{ port: 1111, name: '', protocol: 'TCP' }], api: [tcp] }

            const first = store.loadPorts('prod', 'payments', 'services', 'old')
            await store.loadPorts('prod', 'payments', 'services', 'api')
            release()
            await first

            expect(store.ports).toEqual([tcp])
            expect(store.loadingPorts).toBe(false)
        })

        it('forgets the ports when the form is cleared, even if an answer is still on its way', async () => {
            let release!: () => void
            fake.slowPorts = { api: new Promise<void>((resolve) => { release = resolve }) }
            fake.portsOf = { api: [tcp] }

            const pending = store.loadPorts('prod', 'payments', 'services', 'api')
            store.clearPorts()
            release()
            await pending

            expect(store.ports).toEqual([])
        })

        it('reports a failure to read the ports', async () => {
            fake.refusal = new ApiError('Could not read the service', 'forbidden')
            const errors = seen(AppErrorEvent)

            await store.loadPorts('prod', 'payments', 'services', 'api')

            expect(store.ports).toEqual([])
            expect(errors).toHaveLength(1)
        })

        it('offers the names in a namespace', async () => {
            fake.namesOf = { payments: ['api', 'web'] }

            await store.loadNames('prod', 'payments', 'services')

            expect(store.names).toEqual(['api', 'web'])
        })
    })
})
