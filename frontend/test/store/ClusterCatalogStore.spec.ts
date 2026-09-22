import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

// The store is resolved when its module is imported, so its collaborators are replaced at
// module level rather than through the container afterwards.
const fake = vi.hoisted(() => {
    const state = {
        pinned: [] as string[],
        sources: [] as { path: string; origin: string }[],
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
        addSource: vi.fn(async (path: string, origin: string) => {
            if (state.addFails) {
                throw state.addFails
            }
            state.sources = [...state.sources, { path, origin }]
            return path
        }),
        removeSource: vi.fn(async (path: string) => {
            const removed = state.sources.find(source => source.path === path)
            state.sources = state.sources.filter(source => source.path !== path)

            return removed?.origin === 'paste'
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
import { ClusterRemovedEvent } from '@/domain/events/cluster/ClusterRemovedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterCatalogStore } from '@/store/modules/clusterCatalog/ClusterCatalogStore'

const store = container.resolve(ClusterCatalogStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, (event) => {
    errors.push(event)
})

const removals: ClusterRemovedEvent[] = []
eventBus.registerHandler(ClusterRemovedEvent, (event) => {
    removals.push(event)
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
        removals.length = 0
        fake.state.pinned = []
        fake.state.sources = []
        fake.state.contexts = [context('prod'), context('lab')]
        fake.state.listFails = null
        fake.state.addFails = null
        vi.clearAllMocks()

        store.clear()
        store.pinned = []
        store.sources = []
        store.sourceOrigins = {}
        store.filter = ''
        store.loadError = ''
        store.loadErrorDetail = ''
    })

    describe('loading', () => {
        it('reads contexts, pins and added files in one pass', async () => {
            fake.state.pinned = ['lab']
            fake.state.sources = [{ path: 'D:/work/extra.yaml', origin: 'file' }]

            await store.loadOnce()

            expect(store.items.map(item => item.name)).toEqual(['prod', 'lab'])
            expect(store.pinned).toEqual(['lab'])
            expect(store.sources).toEqual(['D:/work/extra.yaml'])
            expect(store.storeLoaded).toBe(true)
        })

        it('remembers how each file got in so a saved one can be deleted with the cluster', async () => {
            fake.state.sources = [
                { path: 'D:/work/extra.yaml', origin: 'file' },
                { path: 'C:/kubiq/kubeconfigs/lab.yaml', origin: 'paste' },
            ]

            await store.loadOnce()

            expect(store.originOf('C:/kubiq/kubeconfigs/lab.yaml')).toBe('paste')
            expect(store.originOf('D:/work/extra.yaml')).toBe('file')
            expect(store.originOf('C:/Users/tester/.kube/config')).toBe('discovered')
        })

        it('hands the added files to the context list so their contexts show up', async () => {
            fake.state.sources = [{ path: 'D:/work/extra.yaml', origin: 'file' }]

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
            await expect(store.addSource('D:/work/extra.yaml', 'file')).resolves.toBe(true)

            expect(fake.addSource).toHaveBeenCalledWith('D:/work/extra.yaml', 'file', expect.any(Number))
            expect(store.sources).toEqual(['D:/work/extra.yaml'])
        })

        it('says it did not and raises the failure, leaving the catalog as it was', async () => {
            fake.state.addFails = new ApiError('That file holds no kubeconfig contexts')

            await expect(store.addSource('D:/work/empty.yaml', 'file')).resolves.toBe(false)

            expect(errors).toHaveLength(1)
            expect(store.sources).toEqual([])
        })
    })

    describe('deleting a cluster', () => {
        it('describes what goes with the kubeconfig before anything is removed', async () => {
            fake.state.sources = [{ path: 'D:/work/prod.yaml', origin: 'paste' }]
            await store.loadOnce()

            expect(store.deletionOf('D:/work/prod.yaml')).toEqual({
                filePath: 'D:/work/prod.yaml',
                origin: 'paste',
                clusterNames: ['prod'],
            })
        })

        it('hands the service the clusters that go with the file, so their pins go too', async () => {
            fake.state.sources = [{ path: 'D:/work/prod.yaml', origin: 'file' }]
            await store.loadOnce()

            await store.removeSource('D:/work/prod.yaml')

            expect(fake.removeSource).toHaveBeenCalledWith('D:/work/prod.yaml', ['prod'])
            expect(store.sources).toEqual([])
        })

        it('announces the removal so open sessions close and the operator is told', async () => {
            fake.state.sources = [{ path: 'D:/work/prod.yaml', origin: 'paste' }]
            await store.loadOnce()

            await store.removeSource('D:/work/prod.yaml')

            expect(removals).toHaveLength(1)
            expect(removals[0].contextNames).toEqual(['prod'])
            expect(removals[0].kubeconfigDeleted).toBe(true)
        })

        it('says the file stayed when it was one the operator named', async () => {
            fake.state.sources = [{ path: 'D:/work/prod.yaml', origin: 'file' }]
            await store.loadOnce()

            await store.removeSource('D:/work/prod.yaml')

            expect(removals[0].kubeconfigDeleted).toBe(false)
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
