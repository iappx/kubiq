import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UiStateDefaults } from '@/application/services/uiState/constants/UiStateDefaults'
import { UiStateKeys } from '@/application/services/uiState/constants/UiStateKeys'
import { UiStateService } from '@/application/services/uiState/UiStateService'
import { UiPreferenceAdapter } from '@/infrastructure/ui/UiPreferenceAdapter'

const store = new Map<string, string>()

const adapter = new UiPreferenceAdapter()
const service = new UiStateService(adapter)

describe('UiStateService', () => {
    beforeEach(() => {
        store.clear()
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(key => store.get(key) ?? null)
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
            store.set(key, value)
        })
    })

    it('answers with the defaults on a first run', () => {
        expect(service.read()).toEqual({
            density: UiStateDefaults.density,
            sidebarCollapsed: UiStateDefaults.sidebarCollapsed,
            panelWidth: UiStateDefaults.panelWidth,
            dockHeight: UiStateDefaults.dockHeight,
            dockCollapsed: UiStateDefaults.dockCollapsed,
            lastClusterId: '',
        })
    })

    it('reads back what it wrote', () => {
        service.writeDensity('comfortable')
        service.writeSidebarCollapsed(true)
        service.writePanelWidth(600)
        service.writeDockHeight(300)
        service.writeDockCollapsed(false)
        service.writeLastClusterId('prod')

        expect(service.read()).toEqual({
            density: 'comfortable',
            sidebarCollapsed: true,
            panelWidth: 600,
            dockHeight: 300,
            dockCollapsed: false,
            lastClusterId: 'prod',
        })
    })

    it('clamps a stored panel width to what the panel can be', () => {
        store.set(UiStateKeys.panelWidth, '4000')
        expect(service.read().panelWidth).toBe(UiStateDefaults.maxPanelWidth)

        store.set(UiStateKeys.panelWidth, '10')
        expect(service.read().panelWidth).toBe(UiStateDefaults.minPanelWidth)
    })

    it('clamps a stored dock height the same way', () => {
        store.set(UiStateKeys.dockHeight, '5000')
        expect(service.read().dockHeight).toBe(UiStateDefaults.maxDockHeight)
    })

    it('clamps on the way out too, so nothing out of range is ever stored', () => {
        service.writePanelWidth(9000)

        expect(store.get(UiStateKeys.panelWidth)).toBe(String(UiStateDefaults.maxPanelWidth))
    })

    it('falls back to the default for a density nobody recognises', () => {
        store.set(UiStateKeys.density, 'roomy')

        expect(service.read().density).toBe(UiStateDefaults.density)
    })

    it('falls back to the default for a width that is not a number', () => {
        store.set(UiStateKeys.panelWidth, 'wide')

        expect(service.read().panelWidth).toBe(UiStateDefaults.panelWidth)
    })

    it('falls back to the default for a flag that is not a flag', () => {
        store.set(UiStateKeys.sidebarCollapsed, 'yes')

        expect(service.read().sidebarCollapsed).toBe(UiStateDefaults.sidebarCollapsed)
    })

    it('answers with the defaults when the browser refuses to read', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('access denied')
        })

        expect(service.read().density).toBe(UiStateDefaults.density)
    })

    it('stays quiet when the browser refuses to write', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota exceeded')
        })

        expect(() => service.writeDensity('comfortable')).not.toThrow()
    })
})
