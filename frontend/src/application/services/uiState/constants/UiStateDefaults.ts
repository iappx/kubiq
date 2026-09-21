import type { TAppDensity } from '@/domain/models/ui'

export class UiStateDefaults {
    public static readonly density: TAppDensity = 'compact'

    public static readonly sidebarCollapsed: boolean = false

    public static readonly panelWidth: number = 460

    public static readonly minPanelWidth: number = 420

    public static readonly maxPanelWidth: number = 880

    public static readonly dockHeight: number = 240

    public static readonly minDockHeight: number = 120

    public static readonly maxDockHeight: number = 640

    public static readonly dockCollapsed: boolean = true
}
