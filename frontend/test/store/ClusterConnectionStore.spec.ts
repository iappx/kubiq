import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

// @InjectableStore resolves the store the moment its module is imported, so registerInstance
// would land after the real services were injected — hence hoisted module mocks.
const fake = vi.hoisted(() => {
    const open = new Map<string, any>()
    const selections: Record<string, string[]> = {}
    const failOn: Record<string, Error> = {}
    const streamCounts: Record<string, number> = {}

    const built = (clusterId: string) => ({
        clusterId,
        contextName: clusterId,
        server: `https://${clusterId}.example.internal:6443`,
        sessionId: `session-${clusterId}`,
        version: 'v1.31.2',
        canOpenChannel: true,
        channelBlockReason: '',
        connectedAt: 1,
    })

    return {
        open,
        selections,
        failOn,
        streamCounts,
        connect: vi.fn(async (clusterId: string) => {
            const failure = failOn[clusterId]
            if (failure) {
                throw failure
            }
            const connection = built(clusterId)
            open.set(clusterId, connection)
            return connection
        }),
        disconnect: vi.fn(async (clusterId: string) => {
            const closed = open.get(clusterId) ?? null
            open.delete(clusterId)
            return closed
        }),
        disconnectAll: vi.fn(async () => open.clear()),
        openStreams: vi.fn((clusterId: string) => streamCounts[clusterId] ?? 0),
        getSelection: vi.fn(async (clusterId: string) => selections[clusterId] ?? []),
        getSelections: vi.fn(async () => ({ ...selections })),
        setSelection: vi.fn(async (clusterId: string, namespaces: readonly string[]) => {
            const stored = [...namespaces].sort()
            selections[clusterId] = stored
            return stored
        }),
    }
})

vi.mock('@/application/services/cluster/ClusterConnectionService', () => ({
    ClusterConnectionService: class {
        public connect = fake.connect

        public disconnect = fake.disconnect

        public disconnectAll = fake.disconnectAll

        public openStreams = fake.openStreams
    },
}))

vi.mock('@/application/services/clusterNamespace/ClusterNamespaceService', () => ({
    ClusterNamespaceService: class {
        public getSelection = fake.getSelection

        public getSelections = fake.getSelections

        public setSelection = fake.setSelection
    },
}))

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ClusterActivatedEvent } from '@/domain/events/cluster/ClusterActivatedEvent'
import { ClusterConnectedEvent } from '@/domain/events/cluster/ClusterConnectedEvent'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { ClusterNamespacesChangedEvent } from '@/domain/events/cluster/ClusterNamespacesChangedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'

const store = container.resolve(ClusterConnectionStore)
const eventBus = container.resolve(EventBus)

const seen: unknown[] = []
const watch = (type: new (...args: any[]) => unknown): void => {
    eventBus.registerHandler(type, (event) => {
        seen.push(event)
    })
}

watch(ClusterConnectedEvent)
watch(ClusterDisconnectedEvent)
watch(ClusterActivatedEvent)
watch(ClusterNamespacesChangedEvent)
watch(AppErrorEvent)

const eventsOf = <T>(type: new (...args: any[]) => T): T[] => seen.filter(event => event instanceof type) as T[]

describe('ClusterConnectionStore', () => {
    beforeEach(() => {
        fake.open.clear()
        seen.length = 0
        Object.keys(fake.selections).forEach(key => delete fake.selections[key])
        Object.keys(fake.failOn).forEach(key => delete fake.failOn[key])
        Object.keys(fake.streamCounts).forEach(key => delete fake.streamCounts[key])
        vi.clearAllMocks()

        store.connections = []
        store.activeClusterId = ''
        store.connectingIds = []
        store.failures = {}
        store.namespaces = {}
    })

    describe('connecting', () => {
        it('records the connection, makes it active and announces it', async () => {
            await store.connect('prod')

            expect(store.connections.map(c => c.clusterId)).toEqual(['prod'])
            expect(store.activeClusterId).toBe('prod')
            expect(store.active?.version).toBe('v1.31.2')
            expect(store.hasConnections).toBe(true)
            expect(eventsOf(ClusterConnectedEvent)).toHaveLength(1)
        })

        it('flags the attempt while it runs and clears the flag afterwards', async () => {
            const pending = store.connect('prod')
            expect(store.isConnecting('prod')).toBe(true)

            await pending
            expect(store.isConnecting('prod')).toBe(false)
        })

        it('ignores a second attempt while the first is still running', async () => {
            const first = store.connect('prod')
            await store.connect('prod')
            await first

            expect(fake.connect).toHaveBeenCalledTimes(1)
        })

        it('passes the extra kubeconfig files through', async () => {
            await store.connect('prod', ['D:/work/extra.yaml'])

            expect(fake.connect).toHaveBeenCalledWith('prod', ['D:/work/extra.yaml'])
        })

        it('restores the namespace scope the user chose last time', async () => {
            fake.selections.prod = ['payments']

            await store.connect('prod')

            expect(store.namespacesOf('prod')).toEqual(['payments'])
        })
    })

    describe('an unreachable cluster', () => {
        beforeEach(() => {
            fake.failOn.prod = new ApiError('Could not connect to the cluster', 'dial tcp: i/o timeout')
        })

        it('reports the failure without throwing at the caller', async () => {
            await expect(store.connect('prod')).resolves.toBeUndefined()

            expect(store.failureOf('prod')).toBe('Could not connect to the cluster')
            expect(store.isConnected('prod')).toBe(false)
            expect(store.isConnecting('prod')).toBe(false)
            expect(eventsOf(AppErrorEvent)).toHaveLength(1)
        })

        it('forgets the failure once the cluster answers', async () => {
            await store.connect('prod')
            delete fake.failOn.prod

            await store.connect('prod')

            expect(store.failureOf('prod')).toBe('')
            expect(store.isConnected('prod')).toBe(true)
        })

        it('leaves the state of another cluster alone', async () => {
            await store.connect('lab')
            await store.connect('prod')

            expect(store.isConnected('lab')).toBe(true)
            expect(store.failureOf('lab')).toBe('')
        })

        it('says something a human can read when the failure is not an ApiError', async () => {
            fake.failOn.prod = new Error('boom')

            await store.connect('prod')

            expect(store.failureOf('prod')).toBe('The cluster could not be reached')
        })
    })

    describe('two clusters at once', () => {
        beforeEach(async () => {
            await store.connect('prod')
            await store.connect('lab')
            seen.length = 0
        })

        it('holds both and keeps the last one active', () => {
            expect(store.connections.map(c => c.clusterId)).toEqual(['prod', 'lab'])
            expect(store.activeClusterId).toBe('lab')
        })

        it('switches the active cluster and announces it', () => {
            store.activate('prod')

            expect(store.activeClusterId).toBe('prod')
            expect(eventsOf(ClusterActivatedEvent).map(e => e.clusterId)).toEqual(['prod'])
        })

        it('does not announce activating the cluster that is already active', () => {
            store.activate('lab')

            expect(eventsOf(ClusterActivatedEvent)).toEqual([])
        })

        it('refuses to activate a cluster that is not connected', () => {
            store.activate('ghost')

            expect(store.activeClusterId).toBe('lab')
            expect(eventsOf(ClusterActivatedEvent)).toEqual([])
        })

        it('keeps namespace scopes apart', async () => {
            await store.setNamespaces('prod', ['payments'])
            await store.setNamespaces('lab', ['sandbox'])

            expect(store.namespacesOf('prod')).toEqual(['payments'])
            expect(store.namespacesOf('lab')).toEqual(['sandbox'])
        })

        it('disconnecting one leaves the other connected and hands the active role over', async () => {
            await store.disconnect('lab')

            expect(store.connections.map(c => c.clusterId)).toEqual(['prod'])
            expect(store.activeClusterId).toBe('prod')
        })

        it('disconnecting the inactive one leaves the active one alone', async () => {
            await store.disconnect('prod')

            expect(store.activeClusterId).toBe('lab')
        })
    })

    describe('disconnecting', () => {
        it('announces how many streams went down with the cluster', async () => {
            await store.connect('prod')
            fake.streamCounts.prod = 3

            await store.disconnect('prod')

            expect(eventsOf(ClusterDisconnectedEvent)[0]).toMatchObject({
                clusterId: 'prod',
                stoppedStreams: 3,
            })
        })

        it('counts the streams before the service tears them down', async () => {
            await store.connect('prod')
            fake.streamCounts.prod = 2

            await store.disconnect('prod')

            expect(fake.openStreams.mock.invocationCallOrder[0])
                .toBeLessThan(fake.disconnect.mock.invocationCallOrder[0])
        })

        it('says nothing about a cluster that was not connected', async () => {
            await store.disconnect('ghost')

            expect(eventsOf(ClusterDisconnectedEvent)).toEqual([])
        })

        it('leaves nothing active once everything is closed', async () => {
            await store.connect('prod')
            await store.connect('lab')

            await store.disconnectAll()

            expect(store.connections).toEqual([])
            expect(store.activeClusterId).toBe('')
            expect(store.hasConnections).toBe(false)
        })
    })

    describe('namespace scope', () => {
        it('stores the choice and announces it', async () => {
            await store.setNamespaces('prod', ['web', 'api'])

            expect(store.namespacesOf('prod')).toEqual(['api', 'web'])
            expect(eventsOf(ClusterNamespacesChangedEvent)[0]).toMatchObject({
                clusterId: 'prod',
                namespaces: ['api', 'web'],
            })
        })

        it('loads every remembered scope at once', async () => {
            fake.selections.prod = ['payments']
            fake.selections.lab = ['sandbox']

            await store.loadNamespaces()

            expect(store.namespacesOf('prod')).toEqual(['payments'])
            expect(store.namespacesOf('lab')).toEqual(['sandbox'])
        })

        it('is empty for a cluster that chose nothing', () => {
            expect(store.namespacesOf('ghost')).toEqual([])
        })
    })
})
