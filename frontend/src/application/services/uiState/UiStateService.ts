import { inject, injectable } from 'tsyringe'
import { UiStateDefaults } from '@/application/services/uiState/constants/UiStateDefaults'
import { UiStateKeys } from '@/application/services/uiState/constants/UiStateKeys'
import type { TUiState } from '@/application/services/uiState/types/TUiState'
import type { TAppDensity } from '@/domain/models/ui'
import { UiPreferenceAdapter } from '@/infrastructure/ui/UiPreferenceAdapter'

@injectable()
export class UiStateService {
    constructor(
        @inject(UiPreferenceAdapter) private readonly preferences: UiPreferenceAdapter,
    ) {}

    public read(): TUiState {
        return {
            density: UiStateService.density(this.preferences.readText(UiStateKeys.density)),
            sidebarCollapsed: this.preferences.readFlag(UiStateKeys.sidebarCollapsed) ?? UiStateDefaults.sidebarCollapsed,
            panelWidth: this.panelWidth(),
            dockHeight: this.dockHeight(),
            dockCollapsed: this.preferences.readFlag(UiStateKeys.dockCollapsed) ?? UiStateDefaults.dockCollapsed,
            lastClusterId: this.preferences.readText(UiStateKeys.lastClusterId) ?? '',
        }
    }

    public writeDensity(density: TAppDensity): void {
        this.preferences.write(UiStateKeys.density, density)
    }

    public writeSidebarCollapsed(collapsed: boolean): void {
        this.preferences.write(UiStateKeys.sidebarCollapsed, collapsed)
    }

    public writePanelWidth(width: number): void {
        this.preferences.write(UiStateKeys.panelWidth, UiStateService.clampPanelWidth(width))
    }

    public writeDockHeight(height: number): void {
        this.preferences.write(UiStateKeys.dockHeight, UiStateService.clampDockHeight(height))
    }

    public writeDockCollapsed(collapsed: boolean): void {
        this.preferences.write(UiStateKeys.dockCollapsed, collapsed)
    }

    public writeLastClusterId(clusterId: string): void {
        this.preferences.write(UiStateKeys.lastClusterId, clusterId)
    }

    public static clampPanelWidth(width: number): number {
        return UiStateService.clamp(width, UiStateDefaults.minPanelWidth, UiStateDefaults.maxPanelWidth)
    }

    public static clampDockHeight(height: number): number {
        return UiStateService.clamp(height, UiStateDefaults.minDockHeight, UiStateDefaults.maxDockHeight)
    }

    private panelWidth(): number {
        const stored = this.preferences.readNumber(UiStateKeys.panelWidth)
        return stored === null ? UiStateDefaults.panelWidth : UiStateService.clampPanelWidth(stored)
    }

    private dockHeight(): number {
        const stored = this.preferences.readNumber(UiStateKeys.dockHeight)
        return stored === null ? UiStateDefaults.dockHeight : UiStateService.clampDockHeight(stored)
    }

    private static density(stored: string | null): TAppDensity {
        return stored === 'compact' || stored === 'comfortable' ? stored : UiStateDefaults.density
    }

    private static clamp(value: number, min: number, max: number): number {
        if (!Number.isFinite(value)) {
            return min
        }
        return Math.min(Math.max(Math.round(value), min), max)
    }
}
