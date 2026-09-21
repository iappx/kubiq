import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

// The store is resolved when its module is imported, so its collaborators are replaced at
// module level rather than through the container afterwards.
const fake = vi.hoisted(() => {
    const state = {
        pinned: [] as string[],
        sources: [] as string[],
        contexts: [] as any[],
        listFails: null as Error | null,
        addFails: null as Error | null,
    }

    return {
        state,
        listContexts: vi.fn(async () => {
            if (state.listFails) {
                throw state.listFails
            }
            return state.contexts
        }),
        getPinned: vi.fn(async () => [...state.pinned]),
        pin: vi.fn(async (contextName: string) => {
            state.pinned = [...state.pinned, contextName]
        }),
        unpin: vi.fn(async (contextName: string) => {
            state.pinned = state.pinned.filter(name => name !== contextName)
        }),
        getSources: vi.fn(async () => [...state.sources]),
        addSource: vi.fn(async (path: string) => {
            if (state.addFails) {
                throw state.addFails
            }
            state.sources = [...state.sources, path]
            return path
        }),
        removeSource: vi.fn(async (path: string) => {
            state.sources = state.sources.filter(source => source !== path)
        }),
    }
})

vi.mock('@/application/services/clusterCatalog/ClusterCatalogService', () => ({
    ClusterCatalogService: class {
        public getPinned = fake.getPinned

        public pin = fake.pin

        public unpin = fake.unpin

        public getSources = fake.getSources

        public addSource = fake.addSource

        public removeSource = fake.removeSource
    },
}))

vi.mock('@/application/services/cluster/ClusterConnectionService', () => ({
    ClusterConnectionService: class {
        public listContexts = fake.listContexts
    },
}))

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterCatalogStore } from '@/store/modules/clusterCatalog/ClusterCatalogStore'

const store = container.resolve(ClusterCatalogStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, (event) => {
    errors.push(event)
})

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

describe('ClusterCatalogStore', () => {
    beforeEach(() => {
        errors.length = 0
        fake.state.pinned = []
        fake.state.sources = []
        fake.state.contexts = [context('prod'), context('lab')]
        fake.state.listFails = null
        fake.state.addFails = null
        vi.clearAllMocks()

        store.clear()
        store.pinned = []
        store.sources = []
        store.filter = ''
        store.loadError = ''
        store.loadErrorDetail = ''
    })

    describe('loading', () => {
        it('reads contexts, pins and added files in one pass', async () => {
            fake.state.pinned = ['lab']
            fake.state.sources = ['D:/work/extra.yaml']

            await store.loadOnce()

            expect(store.items.map(item => item.name)).toEqual(['prod', 'lab'])
            expect(store.pinned).toEqual(['lab'])
            expect(store.sources).toEqual(['D:/work/extra.yaml'])
            expect(store.storeLoaded).toBe(true)
        })

        it('hands the added files to the context list so their contexts show up', async () => {
            fake.state.sources = ['D:/work/extra.yaml']

            await store.loadOnce()

            expect(fake.listContexts).toHaveBeenCalledWith(['D:/work/extra.yaml'])
        })

        it('reads once and not again', async () => {
            await store.loadOnce()
            await store.loadOnce()

            expect(fake.listContexts).toHaveBeenCalledTimes(1)
        })

        it('reads again when asked to refresh', async () => {
            await store.loadOnce()
            await store.refresh()

            expect(fake.listContexts).toHaveBeenCalledTimes(2)
        })
    })

    describe('a catalog that cannot be read', () => {
        beforeEach(() => {
            fake.state.listFails = new ApiError('The kubeconfig file could not be read', 'line 3, column 1')
        })

        it('keeps the message for the content region as well as raising it', async () => {
            await expect(store.loadOnce()).resolves.toBeUndefined()

            expect(store.loadError).toBe('The kubeconfig file could not be read')
            expect(store.loadErrorDetail).toBe('line 3, column 1')
            expect(errors).toHaveLength(1)
        })

        it('clears the message once a retry works', async () => {
            await store.loadOnce()
            fake.state.listFails = null

            await store.refresh()

            expect(store.loadError).toBe('')
            expect(store.items.map(item => item.name)).toEqual(['prod', 'lab'])
        })

        it('releases the loading flag so the screen can try again', async () => {
            await store.loadOnce()

            expect(store.storeLoading).toBe(false)
        })
    })

    describe('pinning', () => {
        it('moves the pin before the file is written', async () => {
            const pending = store.togglePin('prod')

            expect(store.isPinned('prod')).toBe(true)

            await pending
            expect(fake.pin).toHaveBeenCalledWith('prod', expect.any(Number))
        })

        it('unpins what was pinned', async () => {
            await store.togglePin('prod')

            await store.togglePin('prod')

            expect(store.isPinned('prod')).toBe(false)
            expect(fake.unpin).toHaveBeenCalledWith('prod')
        })

        it('leaves other pins alone', async () => {
            await store.togglePin('prod')
            await store.togglePin('lab')

            await store.togglePin('prod')

            expect(store.pinned).toEqual(['lab'])
        })
    })

    describe('adding a kubeconfig', () => {
        it('says it worked and reloads the catalog', async () => {
            await expect(store.addSource('D:/work/extra.yaml')).resolves.toBe(true)

            expect(fake.addSource).toHaveBeenCalledWith('D:/work/extra.yaml', expect.any(Number))
            expect(store.sources).toEqual(['D:/work/extra.yaml'])
        })

        it('says it did not and raises the failure, leaving the catalog as it was', async () => {
            fake.state.addFails = new ApiError('That file holds no kubeconfig contexts')

            await expect(store.addSource('D:/work/empty.yaml')).resolves.toBe(false)

            expect(errors).toHaveLength(1)
            expect(store.sources).toEqual([])
        })

        it('removes a file and reloads', async () => {
            await store.addSource('D:/work/extra.yaml')

            await store.removeSource('D:/work/extra.yaml')

            expect(store.sources).toEqual([])
        })
    })

    describe('the filter', () => {
        it('is the store\'s own state, untouched by a reload', async () => {
            store.setFilter('prod')

            await store.refresh()

            expect(store.filter).toBe('prod')
        })
    })
})
