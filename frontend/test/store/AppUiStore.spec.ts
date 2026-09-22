import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'
import { UiStateDefaults } from '@/application/services/uiState/constants/UiStateDefaults'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'

const store = container.resolve(AppUiStore)

const memory = new Map<string, string>()

describe('AppUiStore', () => {
    beforeEach(() => {
        memory.clear()
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(key => memory.get(key) ?? null)
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
            memory.set(key, value)
        })

        store.load()
        store.closeDetail()
    })

    it('starts from the defaults', () => {
        expect(store.density).toBe(UiStateDefaults.density)
        expect(store.sidebarCollapsed).toBe(UiStateDefaults.sidebarCollapsed)
        expect(store.dockCollapsed).toBe(UiStateDefaults.dockCollapsed)
    })

    it('remembers the density across a reload', () => {
        store.setDensity('comfortable')
        store.load()

        expect(store.density).toBe('comfortable')
    })

    it('remembers the sidebar being collapsed', () => {
        store.toggleSidebar()
        expect(store.sidebarCollapsed).toBe(true)

        store.load()
        expect(store.sidebarCollapsed).toBe(true)
    })

    it('remembers the panel width, clamped to what the panel can be', () => {
        store.setPanelWidth(9000)

        expect(store.panelWidth).toBe(UiStateDefaults.maxPanelWidth)

        store.load()
        expect(store.panelWidth).toBe(UiStateDefaults.maxPanelWidth)
    })

    it('remembers the dock height and whether it is collapsed', () => {
        store.setDockHeight(320)
        store.setDockCollapsed(false)
        store.load()

        expect(store.dockHeight).toBe(320)
        expect(store.dockCollapsed).toBe(false)
    })

    it('remembers the last cluster it was on', () => {
        store.setLastClusterId('prod')
        store.load()

        expect(store.lastClusterId).toBe('prod')
    })

    it('holds the addressed object without persisting it', () => {
        store.openDetail('prod', 'api-7f9')

        expect(store.detailOpen).toBe(true)
        expect(store.detailNamespace).toBe('prod')
        expect(store.detailName).toBe('api-7f9')

        store.load()
        expect(store.detailOpen).toBe(true)
        expect(memory.has('ui-detail-key')).toBe(false)
    })

    it('counts a cluster-scoped object with no namespace as open', () => {
        store.openDetail('', 'worker-1')

        expect(store.detailOpen).toBe(true)
        expect(store.detailName).toBe('worker-1')
    })

    it('is closed while only a namespace is known', () => {
        store.openDetail('prod', '')

        expect(store.detailOpen).toBe(false)
    })

    it('closes the detail panel', () => {
        store.openDetail('prod', 'api-7f9')
        store.closeDetail()

        expect(store.detailOpen).toBe(false)
        expect(store.detailNamespace).toBe('')
        expect(store.detailName).toBe('')
    })
})
