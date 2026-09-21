import { InjectableStore, StoreBase } from '@/lib/vue-store'
import type { TDockTab } from '@/store/modules/dock/types/TDockTab'

@InjectableStore
export class DockStore extends StoreBase<DockStore> {
    public tabs: TDockTab[] = []

    public activeKey = ''

    public get hasTabs(): boolean {
        return this.tabs.length > 0
    }

    public tabsOf(clusterId: string): TDockTab[] {
        return this.tabs.filter(tab => tab.clusterId === clusterId)
    }

    public open(tab: TDockTab): void {
        const known = this.tabs.some(open => open.key === tab.key)
        this.tabs = known ? this.tabs.map(open => (open.key === tab.key ? tab : open)) : [...this.tabs, tab]
        this.activeKey = tab.key
    }

    public activate(key: string): void {
        if (this.tabs.some(tab => tab.key === key)) {
            this.activeKey = key
        }
    }

    public close(key: string): void {
        this.replaceTabs(this.tabs.filter(tab => tab.key !== key))
    }

    // The registry has already drained the streams by the time ClusterDisconnectedEvent is raised, so this only clears tabs.
    public closeCluster(clusterId: string): void {
        this.replaceTabs(this.tabs.filter(tab => tab.clusterId !== clusterId))
    }

    public closeAll(): void {
        this.replaceTabs([])
    }

    private replaceTabs(tabs: TDockTab[]): void {
        this.tabs = tabs

        if (!tabs.some(tab => tab.key === this.activeKey)) {
            this.activeKey = tabs[tabs.length - 1]?.key ?? ''
        }
    }
}
