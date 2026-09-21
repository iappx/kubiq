import { StoreBase } from '@/lib/vue-store/base/StoreBase'

export abstract class LoadableItemStoreBase<TItem extends object, TStore extends Record<string, any>> extends StoreBase<TStore> {
    public static readonly UpdateTime = 1000

    public items: TItem[] = []

    public storeLoaded = false

    public storeLoading = false

    /** Milliseconds before a loaded collection goes stale; `0` — never. */
    protected updateInterval = 0

    protected nextUpdate = 0

    protected abstract loadItems(): Promise<TItem[]>

    public async loadIfNeeded(): Promise<void> {
        if (this.storeLoading) {
            return
        }
        if (this.storeLoaded && (this.updateInterval === 0 || this.nextUpdate > Date.now())) {
            return
        }
        await this.load()
    }

    public async load(): Promise<void> {
        this.storeLoading = true
        try {
            this.items = await this.loadItems()
            this.nextUpdate = Date.now() + this.updateInterval
            this.storeLoaded = true
        } finally {
            // Even a failed load has to release the flag, or the store never
            // tries again and the page keeps showing skeletons.
            this.storeLoading = false
        }
    }

    public clear(): void {
        this.items = []
        this.storeLoaded = false
        this.storeLoading = false
        this.nextUpdate = 0
    }
}
