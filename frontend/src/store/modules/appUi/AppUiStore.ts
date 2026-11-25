import { inject } from 'tsyringe'
import { UiStateDefaults } from '@/application/services/uiState/constants/UiStateDefaults'
import { TablePrefsCodec } from '@/application/services/uiState/models/TablePrefsCodec'
import type { TTablePrefs } from '@/application/services/uiState/types/TTablePrefs'
import type { TTableSortPref } from '@/application/services/uiState/types/TTableSortPref'
import { UiStateService } from '@/application/services/uiState/UiStateService'
import type { TAppDensity } from '@/domain/models/ui'
import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class AppUiStore extends StoreBase<AppUiStore> {
    public density: TAppDensity = UiStateDefaults.density

    public sidebarCollapsed = UiStateDefaults.sidebarCollapsed

    public panelWidth = UiStateDefaults.panelWidth

    public dockHeight = UiStateDefaults.dockHeight

    public dockCollapsed = UiStateDefaults.dockCollapsed

    public lastClusterId = ''

    public tablePrefs: Record<string, TTablePrefs> = {}

    public detailNamespace = ''

    public detailName = ''

    constructor(
        @inject(UiStateService) private readonly uiStateService: UiStateService,
    ) {
        super()
    }

    setup(): void {
        this.load()
    }

    public get detailOpen(): boolean {
        return this.detailName !== ''
    }

    public openDetail(namespace: string, name: string): void {
        this.detailNamespace = namespace
        this.detailName = name
    }

    public closeDetail(): void {
        this.detailNamespace = ''
        this.detailName = ''
    }

    public load(): void {
        const stored = this.uiStateService.read()

        this.density = stored.density
        this.sidebarCollapsed = stored.sidebarCollapsed
        this.panelWidth = stored.panelWidth
        this.dockHeight = stored.dockHeight
        this.dockCollapsed = stored.dockCollapsed
        this.lastClusterId = stored.lastClusterId
        this.tablePrefs = stored.tablePrefs
    }

    public setDensity(density: TAppDensity): void {
        this.density = density
        this.uiStateService.writeDensity(density)
    }

    public setSidebarCollapsed(collapsed: boolean): void {
        this.sidebarCollapsed = collapsed
        this.uiStateService.writeSidebarCollapsed(collapsed)
    }

    public toggleSidebar(): void {
        this.setSidebarCollapsed(!this.sidebarCollapsed)
    }

    public setPanelWidth(width: number): void {
        this.panelWidth = UiStateService.clampPanelWidth(width)
        this.uiStateService.writePanelWidth(this.panelWidth)
    }

    public setDockHeight(height: number): void {
        this.dockHeight = UiStateService.clampDockHeight(height)
        this.uiStateService.writeDockHeight(this.dockHeight)
    }

    public setDockCollapsed(collapsed: boolean): void {
        this.dockCollapsed = collapsed
        this.uiStateService.writeDockCollapsed(collapsed)
    }

    public setLastClusterId(clusterId: string): void {
        if (this.lastClusterId === clusterId) {
            return
        }

        this.lastClusterId = clusterId
        this.uiStateService.writeLastClusterId(clusterId)
    }

    public tablePrefsOf(tableKey: string): TTablePrefs | undefined {
        return Object.prototype.hasOwnProperty.call(this.tablePrefs, tableKey)
            ? this.tablePrefs[tableKey]
            : undefined
    }

    public setTableHiddenKeys(tableKey: string, hiddenKeys: readonly string[]): void {
        this.updateTablePrefs(tableKey, { hiddenKeys: [...hiddenKeys] })
    }

    public setTableSort(tableKey: string, sort: TTableSortPref | null): void {
        this.updateTablePrefs(tableKey, {
            sort: sort ? { key: sort.key, direction: sort.direction } : null,
        })
    }

    private updateTablePrefs(tableKey: string, patch: TTablePrefs): void {
        if (!tableKey) {
            return
        }

        const current = this.tablePrefsOf(tableKey)
        const next: Record<string, TTablePrefs> = { ...this.tablePrefs }
        delete next[tableKey]
        next[tableKey] = {
            ...current,
            ...patch,
        }

        const keys = Object.keys(next)
        if (keys.length > TablePrefsCodec.maxEntries) {
            for (const key of keys.slice(0, keys.length - TablePrefsCodec.maxEntries)) {
                delete next[key]
            }
        }

        this.tablePrefs = next
        this.uiStateService.writeTablePrefs(this.tablePrefs)
    }
}
