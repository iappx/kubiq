import { inject } from 'tsyringe'
import { UiStateDefaults } from '@/application/services/uiState/constants/UiStateDefaults'
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
}
