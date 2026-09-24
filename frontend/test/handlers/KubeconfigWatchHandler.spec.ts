import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KubeconfigWatchHandler } from '@/application/handlers/cluster/KubeconfigWatchHandler'
import type { ClusterCatalogService } from '@/application/services/clusterCatalog/ClusterCatalogService'
import type { KubeconfigService } from '@/application/services/kubeconfig/KubeconfigService'
import type { ClusterCatalogStore } from '@/store/modules/clusterCatalog/ClusterCatalogStore'

let stamp: string
let sources: string[]
let fingerprintFails: Error | null

const fingerprint = vi.fn(async () => {
    if (fingerprintFails) {
        throw fingerprintFails
    }
    return stamp
})
const kubeconfigService = { fingerprint } as unknown as KubeconfigService
const catalogService = { getSourcePaths: async () => sources } as unknown as ClusterCatalogService
const store = {
    storeLoaded: true,
    storeLoading: false,
    refresh: vi.fn(async () => undefined),
}

const build = (): KubeconfigWatchHandler => new KubeconfigWatchHandler(
    kubeconfigService,
    catalogService,
    store as unknown as ClusterCatalogStore,
)

describe('KubeconfigWatchHandler', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        stamp = 'config|512|1'
        sources = []
        fingerprintFails = null
        store.storeLoaded = true
        store.storeLoading = false
        store.refresh.mockClear()
        fingerprint.mockClear()
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('takes the first look as the baseline and reloads nothing', async () => {
        await build().check()

        expect(store.refresh).not.toHaveBeenCalled()
    })

    it('reloads the catalog once the files change', async () => {
        const handler = build()
        await handler.check()

        stamp = 'config|540|2'
        await handler.check()
        await handler.check()

        expect(store.refresh).toHaveBeenCalledTimes(1)
    })

    it('stays still while nothing changes', async () => {
        const handler = build()
        await handler.check()
        await handler.check()

        expect(store.refresh).not.toHaveBeenCalled()
    })

    it('watches the files and folders added in Settings as well', async () => {
        sources = ['/home/tester/Configs/.kube']

        await build().check()

        expect(fingerprint).toHaveBeenCalledWith(['/home/tester/Configs/.kube'])
    })

    it('leaves a catalog nobody has opened yet unloaded', async () => {
        store.storeLoaded = false
        const handler = build()
        await handler.check()

        stamp = 'config|540|2'
        await handler.check()

        expect(store.refresh).not.toHaveBeenCalled()
    })

    it('holds a change seen during a load until the load is over', async () => {
        const handler = build()
        await handler.check()

        stamp = 'config|540|2'
        store.storeLoading = true
        await handler.check()
        expect(store.refresh).not.toHaveBeenCalled()

        store.storeLoading = false
        await handler.check()
        expect(store.refresh).toHaveBeenCalledTimes(1)
    })

    it('looks again on its own every few seconds', async () => {
        build()

        await vi.advanceTimersByTimeAsync(KubeconfigWatchHandler.intervalMs)
        stamp = 'config|540|2'
        await vi.advanceTimersByTimeAsync(KubeconfigWatchHandler.intervalMs)

        expect(fingerprint).toHaveBeenCalledTimes(2)
        expect(store.refresh).toHaveBeenCalledTimes(1)
    })

    it('shrugs off a failed look and tries again next time', async () => {
        const handler = build()
        await handler.check()

        fingerprintFails = new Error('binding is gone')
        await expect(handler.check()).resolves.toBeUndefined()

        fingerprintFails = null
        stamp = 'config|540|2'
        await handler.check()

        expect(store.refresh).toHaveBeenCalledTimes(1)
    })
})
