import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'
import { computed, watch } from 'vue'

const fake = vi.hoisted(() => {
    const state = {
        contexts: [] as Record<string, unknown>[],
        sources: [] as string[],
        catalogFails: null as Error | null,
        connectFails: null as Error | null,
        reclaimed: [] as Record<string, unknown>[],
        kinds: [] as unknown[],
        available: [] as string[],
        selections: {} as Record<string, string[]>,
    }

    const connection = (contextName: string): Record<string, unknown> => ({
        clusterId: contextName,
        contextName,
        server: `https://${contextName}.example.internal:6443`,
        sessionId: `session-${contextName}`,
        version: 'v1.31.0',
        canOpenChannel: true,
        channelBlockReason: '',
        connectedAt: 1,
    })

    return {
        state,
        connection,
        listContexts: vi.fn(async () => {
            if (state.catalogFails) {
                throw state.catalogFails
            }
            return state.contexts
        }),
        adopt: vi.fn(async () => state.reclaimed),
        connect: vi.fn(async (contextName: string) => {
            if (state.connectFails) {
                throw state.connectFails
            }
            return connection(contextName)
        }),
        disconnect: vi.fn(async () => null),
        disconnectAll: vi.fn(async () => undefined),
        openStreams: vi.fn(() => 0),
        listKinds: vi.fn(async () => state.kinds),
        list: vi.fn(async () => ({ names: state.available, resourceVersion: 'rv-1' })),
        watch: vi.fn(async () => undefined),
        unwatch: vi.fn(async () => undefined),
        // The real service builds a fresh array out of the stored entity on every read,
        // so a fake that hands back the same instance twice hides an identity change.
        getSelection: vi.fn(async (clusterId: string) => [...(state.selections[clusterId] ?? [])]),
        getSelections: vi.fn(async () => Object.fromEntries(
            Object.entries(state.selections).map(([clusterId, namespaces]) => [clusterId, [...namespaces]]),
        )),
        setSelection: vi.fn(async (_: string, namespaces: string[]) => namespaces),
        getSources: vi.fn(async () => state.sources.map(path => ({ path, origin: 'file' }))),
        getPinned: vi.fn(async () => [] as string[]),
        pin: vi.fn(async () => undefined),
        unpin: vi.fn(async () => undefined),
        addSource: vi.fn(async (path: string) => path),
        removeSource: vi.fn(async () => undefined),
    }
})

vi.mock('@/application/services/cluster/ClusterConnectionService', () => ({
    ClusterConnectionService: class {
        public listContexts = fake.listContexts

        public adopt = fake.adopt

        public connect = fake.connect

        public disconnect = fake.disconnect

        public disconnectAll = fake.disconnectAll

        public openStreams = fake.openStreams
    },
}))

vi.mock('@/application/services/clusterCatalog/ClusterCatalogService', () => ({
    ClusterCatalogService: class {
        public getSources = fake.getSources

        public getPinned = fake.getPinned

        public pin = fake.pin

        public unpin = fake.unpin

        public addSource = fake.addSource

        public removeSource = fake.removeSource
    },
}))

vi.mock('@/application/services/clusterNamespace/ClusterNamespaceService', () => ({
    ClusterNamespaceService: class {
        public list = fake.list

        public watch = fake.watch

        public unwatch = fake.unwatch

        public getSelection = fake.getSelection

        public getSelections = fake.getSelections

        public setSelection = fake.setSelection
    },
}))

vi.mock('@/application/services/clusterDiscovery/ClusterDiscoveryService', () => ({
    ClusterDiscoveryService: class {
        public listKinds = fake.listKinds
    },
}))

import { ClusterEntryService } from '@/application/services/clusterEntry/ClusterEntryService'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { ClusterCatalogStore } from '@/store/modules/clusterCatalog/ClusterCatalogStore'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'
import { ClusterNamespaceStore } from '@/store/modules/clusterNamespace/ClusterNamespaceStore'

const service = container.resolve(ClusterEntryService)
const catalogStore = container.resolve(ClusterCatalogStore)
const connectionStore = container.resolve(ClusterConnectionStore)
const discoveryStore = container.resolve(ClusterDiscoveryStore)
const namespaceStore = container.resolve(ClusterNamespaceStore)
const uiStore = container.resolve(AppUiStore)

const context = (name: string): Record<string, unknown> => ({
    name,
    filePath: `D:/work/${name}.yaml`,
    clusterName: `${name}-cluster`,
    server: `https://${name}.example.internal:6443`,
    namespace: 'default',
    authType: 'token',
    isCurrent: false,
    isSupported: true,
    unsupportedReason: '',
})

describe('ClusterEntryService', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        fake.state.contexts = [context('prod'), context('staging')]
        fake.state.sources = []
        fake.state.catalogFails = null
        fake.state.connectFails = null
        fake.state.reclaimed = []
        fake.state.kinds = [KubeResourceRegistry.find('', 'pods')]
        fake.state.available = ['default', 'payments']
        fake.state.selections = { staging: ['payments'] }

        catalogStore.clear()
        catalogStore.pinned = []
        catalogStore.sources = []
        catalogStore.loadError = ''
        catalogStore.loadErrorDetail = ''

        connectionStore.connections = []
        connectionStore.connectingIds = []
        connectionStore.failures = {}
        connectionStore.namespaces = {}
        connectionStore.activeClusterId = ''
        connectionStore.adopted = false

        discoveryStore.kinds = {}
        discoveryStore.failures = {}
        discoveryStore.loadingIds = []

        namespaceStore.available = {}
        namespaceStore.failures = {}
        namespaceStore.loadingIds = []

        uiStore.lastClusterId = ''
    })

    describe('a cold entry', () => {
        it('reads the catalog, connects and loads what the shell needs, in that order', async () => {
            await expect(service.enter('staging')).resolves.toBe('ready')

            expect(fake.listContexts).toHaveBeenCalledTimes(1)
            expect(fake.connect).toHaveBeenCalledWith('staging', [])
            expect(connectionStore.isConnected('staging')).toBe(true)
            expect(connectionStore.activeClusterId).toBe('staging')
            expect(discoveryStore.kindsOf('staging')).toHaveLength(1)
            expect(namespaceStore.availableOf('staging')).toEqual(['default', 'payments'])
        })

        it('restores the namespace scope the operator had chosen', async () => {
            await service.enter('staging')

            expect(connectionStore.namespacesOf('staging')).toEqual(['payments'])
        })

        it('knows the namespace scope before the session opens, so no list goes out unscoped', async () => {
            fake.connect.mockImplementationOnce(async (contextName: string) => {
                expect(connectionStore.namespacesOf('staging')).toEqual(['payments'])

                return fake.connection(contextName)
            })

            await service.enter('staging')
        })

        it('remembers the cluster as the last one entered', async () => {
            await service.enter('staging')

            expect(uiStore.lastClusterId).toBe('staging')
        })

        it('hands the added kubeconfig files to the connection attempt', async () => {
            fake.state.sources = ['D:/work/extra.yaml']

            await service.enter('staging')

            expect(fake.connect).toHaveBeenCalledWith('staging', ['D:/work/extra.yaml'])
        })

        it('runs one sequence however many callers ask at once', async () => {
            const [first, second] = await Promise.all([service.enter('staging'), service.enter('staging')])

            expect(first).toBe('ready')
            expect(second).toBe('ready')
            expect(fake.connect).toHaveBeenCalledTimes(1)
        })
    })

    describe('the scope the first list goes out with', () => {
        // A stand-in for the resource page: it lists when the shell lets it mount, and again
        // whenever the scope it was handed changes, which is what @Watch('namespaces') does.
        const listsDuring = async (entry: Promise<unknown>): Promise<string[][]> => {
            const lists: string[][] = []
            const scope = computed(() => connectionStore.namespacesOf('staging'))
            const mounted = computed(() => service.phaseOf('staging') === 'ready')

            const stopMount = watch(mounted, (open) => {
                if (open) {
                    lists.push([...scope.value])
                }
            }, { flush: 'sync' })

            const stopScope = watch(scope, () => {
                if (mounted.value) {
                    lists.push([...scope.value])
                }
            }, { flush: 'sync' })

            await entry
            stopMount()
            stopScope()

            return lists
        }

        it('lists once, already scoped, when the cluster is connected fresh', async () => {
            expect(await listsDuring(service.enter('staging'))).toEqual([['payments']])
        })

        it('lists once, already scoped, when the session is taken back after a reload', async () => {
            fake.state.reclaimed = [fake.connection('staging')]

            expect(await listsDuring(service.enter('staging'))).toEqual([['payments']])
        })

        it('lists once against every namespace when the operator chose no scope', async () => {
            fake.state.selections = {}

            expect(await listsDuring(service.enter('staging'))).toEqual([[]])
        })
    })

    describe('taking back the sessions a reload left open', () => {
        it('offers the Go side the context names the catalog knows', async () => {
            await service.enter('staging')

            expect(fake.adopt).toHaveBeenCalledWith(['prod', 'staging'])
        })

        it('uses an adopted session instead of opening a second one', async () => {
            fake.state.reclaimed = [fake.connection('staging')]

            await expect(service.enter('staging')).resolves.toBe('ready')

            expect(fake.connect).not.toHaveBeenCalled()
            expect(connectionStore.isConnected('staging')).toBe(true)
        })

        it('asks for the open sessions once, not on every entry', async () => {
            await service.enter('staging')
            await service.enter('prod')

            expect(fake.adopt).toHaveBeenCalledTimes(1)
        })
    })

    describe('a cluster the address names but the catalog does not', () => {
        it('says so rather than connecting to something else', async () => {
            await expect(service.enter('gone')).resolves.toBe('unknown')

            expect(fake.connect).not.toHaveBeenCalled()
        })

        it('treats an empty cluster id the same way', async () => {
            await expect(service.enter('')).resolves.toBe('unknown')

            expect(fake.listContexts).not.toHaveBeenCalled()
        })
    })

    describe('a cluster that will not answer', () => {
        beforeEach(() => {
            fake.state.connectFails = new ApiError('The cluster rejected the credentials', 'Unauthorized', 401)
        })

        it('reports the failure instead of leaving the screen empty', async () => {
            await expect(service.enter('staging')).resolves.toBe('failed')

            expect(service.phaseOf('staging')).toBe('failed')
            expect(service.failureOf('staging')).toBe('The cluster rejected the credentials')
        })

        it('tries again when asked, and succeeds once the cluster comes back', async () => {
            await service.enter('staging')
            fake.state.connectFails = null

            await expect(service.retry('staging')).resolves.toBe('ready')

            expect(service.phaseOf('staging')).toBe('ready')
        })

        it('forgets the old failure the moment a new attempt starts, so the shell never flashes it', async () => {
            await service.enter('staging')
            fake.state.connectFails = null

            const pending = service.enter('staging')

            expect(service.phaseOf('staging')).toBe('connecting')
            await expect(pending).resolves.toBe('ready')
        })
    })

    describe('a catalog that cannot be read at all', () => {
        beforeEach(() => {
            fake.state.catalogFails = new ApiError('The kubeconfig file could not be read', 'line 3, column 1')
        })

        it('blames the catalog rather than calling the cluster unknown', async () => {
            await expect(service.enter('staging')).resolves.toBe('failed')

            expect(service.failureOf('staging')).toBe('The kubeconfig file could not be read')
        })

        it('does not try to connect to a cluster it could not look up', async () => {
            await service.enter('staging')

            expect(fake.connect).not.toHaveBeenCalled()
        })
    })

    describe('the phase the shell renders', () => {
        it('is connecting before anything has been read', () => {
            expect(service.phaseOf('staging')).toBe('connecting')
        })

        it('is connecting while the connection is being opened', async () => {
            const pending = service.enter('staging')
            await Promise.resolve()

            expect(service.phaseOf('staging')).not.toBe('unknown')
            await pending
        })

        it('is ready once the entry has run', async () => {
            await service.enter('staging')

            expect(service.phaseOf('staging')).toBe('ready')
        })
    })
})
