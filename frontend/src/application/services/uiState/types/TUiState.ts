import type { TAppDensity } from '@/domain/models/ui'

export type TUiState = {
    density: TAppDensity
    sidebarCollapsed: boolean
    panelWidth: number
    dockHeight: number
    dockCollapsed: boolean
    lastClusterId: string
}
