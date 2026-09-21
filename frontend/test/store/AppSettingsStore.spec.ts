import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

// The store is resolved when its module is imported, so its collaborator is replaced at
// module level rather than through the container afterwards.
const fake = vi.hoisted(() => {
    const state = {
        settings: {
            kubectlPath: '',
            helmPath: '',
            nodeShellImage: '',
            closeToTray: false,
        } as Record<string, unknown>,
        clusters: [] as any[],
        storage: { root: '', logs: '', version: 0 },
        schemaVersion: 0,
        readFails: null as Error | null,
        saveFails: null as Error | null,
        openFails: null as Error | null,
    }

    return {
        state,
        read: vi.fn(async () => {
            if (state.readFails) {
                throw state.readFails
            }
            return { ...state.settings }
        }),
        save: vi.fn(async (settings: Record<string, unknown>) => {
            if (state.saveFails) {
                throw state.saveFails
            }
            state.settings = { ...settings }
            return { ...settings }
        }),
        listClusters: vi.fn(async () => [...state.clusters]),
        saveClusterSettings: vi.fn(async (draft: any) => draft),
        removeClusterSettings: vi.fn(async () => undefined),
        storageInfo: vi.fn(async () => ({ ...state.storage })),
        schemaVersion: vi.fn(async () => state.schemaVersion),
        openLogFolder: vi.fn(async () => {
            if (state.openFails) {
                throw state.openFails
            }
        }),
    }
})

vi.mock('@/application/services/settings/SettingsService', () => ({
    SettingsService: class {
        public read = fake.read

        public save = fake.save

        public listClusters = fake.listClusters

        public saveClusterSettings = fake.saveClusterSettings

        public removeClusterSettings = fake.removeClusterSettings

        public storageInfo = fake.storageInfo

        public schemaVersion = fake.schemaVersion

        public openLogFolder = fake.openLogFolder
    },
}))

import type { TClusterSettingsDraft } from '@/domain/entities/settings'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { AppSettings } from '@/domain/models/settings'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppSettingsStore } from '@/store/modules/settings/AppSettingsStore'

const store = container.resolve(AppSettingsStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, (event) => {
    errors.push(event)
})

const entry = (clusterId: string): TClusterSettingsDraft => ({
    clusterId,
    prometheusSource: 'url',
    prometheusUrl: 'http://prometheus:9090',
    prometheusService: '',
    prometheusLayout: 'kubePrometheusStack',
})

describe('AppSettingsStore', () => {
    beforeEach(() => {
        errors.length = 0
        fake.state.settings = AppSettings.defaults() as unknown as Record<string, unknown>
        fake.state.clusters = []
        fake.state.storage = { root: '', logs: '', version: 0 }
        fake.state.schemaVersion = 0
        fake.state.readFails = null
        fake.state.saveFails = null
        fake.state.openFails = null
        vi.clearAllMocks()

        store.settings = AppSettings.defaults()
        store.clusters = []
        store.storage = { root: '', logs: '', version: 0 }
        store.schemaVersion = 0
        store.loaded = false
        store.loading = false
        store.saving = false
        store.loadError = ''
        store.loadErrorDetail = ''
    })

    describe('loading', () => {
        it('starts from the defaults', () => {
            expect(store.settings).toEqual(AppSettings.defaults())
            expect(store.loaded).toBe(false)
        })

        it('reads settings, clusters, storage and the schema version in one pass', async () => {
            fake.state.settings = { ...AppSettings.defaults(), kubectlPath: '/usr/bin/kubectl' }
            fake.state.clusters = [entry('prod')]
            fake.state.storage = { root: 'C:/profile/kubiq', logs: 'C:/profile/kubiq/logs', version: 1 }
            fake.state.schemaVersion = 1

            await store.loadOnce()

            expect(store.settings.kubectlPath).toBe('/usr/bin/kubectl')
            expect(store.clusters.map(item => item.clusterId)).toEqual(['prod'])
            expect(store.storage.logs).toBe('C:/profile/kubiq/logs')
            expect(store.schemaVersion).toBe(1)
            expect(store.loaded).toBe(true)
        })

        it('reads once and not again', async () => {
            await store.loadOnce()
            await store.loadOnce()

            expect(fake.read).toHaveBeenCalledTimes(1)
        })

        it('reads again when told to', async () => {
            await store.loadOnce()
            await store.load()

            expect(fake.read).toHaveBeenCalledTimes(2)
        })
    })

    describe('a profile that cannot be read', () => {
        beforeEach(() => {
            fake.state.readFails = new ApiError('Could not load the data', 'the file is locked')
        })

        it('keeps the message for the content region as well as raising it', async () => {
            await expect(store.loadOnce()).resolves.toBeUndefined()

            expect(store.loadError).toBe('Could not load the data')
            expect(store.loadErrorDetail).toBe('the file is locked')
            expect(errors).toHaveLength(1)
        })

        it('releases the loading flag so the screen can retry', async () => {
            await store.loadOnce()

            expect(store.loading).toBe(false)
        })

        it('clears the message once a retry works', async () => {
            await store.loadOnce()
            fake.state.readFails = null

            await store.load()

            expect(store.loadError).toBe('')
        })
    })

    describe('editing one value at a time', () => {
        it('writes the whole document with only that value changed', async () => {
            await store.setKubectlPath('/usr/bin/kubectl')

            expect(fake.save).toHaveBeenCalledWith({ ...AppSettings.defaults(), kubectlPath: '/usr/bin/kubectl' })
            expect(store.settings.kubectlPath).toBe('/usr/bin/kubectl')
        })

        it('keeps the values already stored when another one changes', async () => {
            await store.setKubectlPath('/usr/bin/kubectl')
            await store.setHelmPath('/usr/bin/helm')

            expect(store.settings.kubectlPath).toBe('/usr/bin/kubectl')
            expect(store.settings.helmPath).toBe('/usr/bin/helm')
        })

        it('stores the node shell image and the window behaviour', async () => {
            await store.setNodeShellImage('registry.internal/shell:1')
            await store.setCloseToTray(true)

            expect(store.settings.nodeShellImage).toBe('registry.internal/shell:1')
            expect(store.settings.closeToTray).toBe(true)
        })

        it('raises a failed write and leaves the flag down', async () => {
            fake.state.saveFails = new ApiError('Could not save the changes')

            await store.setKubectlPath('/usr/bin/kubectl')

            expect(errors).toHaveLength(1)
            expect(store.saving).toBe(false)
            expect(store.settings.kubectlPath).toBe('')
        })
    })

    describe('per-cluster Prometheus', () => {
        it('adds a cluster and keeps the list sorted', async () => {
            await store.saveCluster(entry('prod'))
            await store.saveCluster(entry('lab'))

            expect(store.clusters.map(item => item.clusterId)).toEqual(['lab', 'prod'])
        })

        it('replaces a cluster rather than listing it twice', async () => {
            await store.saveCluster(entry('prod'))
            await store.saveCluster({ ...entry('prod'), prometheusUrl: 'http://metrics:9090' })

            expect(store.clusters).toHaveLength(1)
            expect(store.clusters[0].prometheusUrl).toBe('http://metrics:9090')
        })

        it('removes a cluster from the list', async () => {
            await store.saveCluster(entry('prod'))

            await store.removeCluster('prod')

            expect(store.clusters).toEqual([])
            expect(fake.removeClusterSettings).toHaveBeenCalledWith('prod')
        })

        it('raises a failed save without changing the list', async () => {
            fake.saveClusterSettings.mockRejectedValueOnce(new ApiError('Could not save the changes'))

            await store.saveCluster(entry('prod'))

            expect(errors).toHaveLength(1)
            expect(store.clusters).toEqual([])
        })
    })

    describe('the log folder', () => {
        it('asks the service to open it', async () => {
            await store.openLogFolder()

            expect(fake.openLogFolder).toHaveBeenCalled()
            expect(errors).toHaveLength(0)
        })

        it('raises the failure instead of throwing outwards', async () => {
            fake.state.openFails = new ApiError('Could not open the log folder')

            await expect(store.openLogFolder()).resolves.toBeUndefined()

            expect(errors).toHaveLength(1)
        })
    })
})
