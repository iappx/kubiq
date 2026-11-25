import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@iappx/vue-facing-di', () => ({
    Component: () => <T>(target: T): T => target,
    Prop: () => () => undefined,
    VModel: () => () => undefined,
    Watch: () => () => undefined,
    VueBase: class {},
}))

import UiDataTable from '@/components/common/table/UiDataTable.vue'
import { UiTableVirtualizer } from '@/components/common/table/UiTableVirtualizer'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'
import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'
import type { TUiTableSort } from '@/components/common/table/types/TUiTableSort'
import type { TUiVirtualWindow } from '@/components/common/table/types/TUiVirtualWindow'

type TRow = { id: string; name: string; count: number }

const columns: TUiTableColumn[] = [
    { key: 'name', title: 'Name', locked: true },
    { key: 'count', title: 'Count', align: 'right' },
]

const makeRows = (count: number): TRow[] => Array.from({ length: count }, (_, index) => ({
    id: `row-${index}`,
    name: `pod-${String(index).padStart(4, '0')}`,
    count: index,
}))

class FakeResizeObserver {
    public static instances: FakeResizeObserver[] = []

    public readonly observed: Element[] = []

    public disconnected = false

    private readonly callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback
        FakeResizeObserver.instances.push(this)
    }

    public observe(target: Element): void {
        this.observed.push(target)
    }

    public unobserve(): void {
        return
    }

    public disconnect(): void {
        this.disconnected = true
    }

    public trigger(): void {
        this.callback([], this as unknown as ResizeObserver)
    }
}

type TDataTableInstance = {
    columns: TUiTableColumn[]
    rows: TRow[]
    rowKey: string
    label: string
    sort: TUiTableSort | null
    selected: string[]
    cursor: string | null
    selectable: boolean
    density: TUiTableDensity
    actions: TUiMenuItem[]
    scrollTop: number
    viewportHeight: number
    headerHeight: number
    menuOpen: boolean
    menuRowKey: string | null
    readonly keys: string[]
    readonly virtualWindow: TUiVirtualWindow
    readonly visibleEntries: Array<{ row: TRow; key: string; index: number }>
    $refs: { scroller?: HTMLElement }
    $emit: ReturnType<typeof vi.fn>
    mounted: () => void
    beforeUnmount: () => void
    rowsChanged: () => void
    sortChanged: () => void
    densityChanged: () => void
    onSelectClick: (event: MouseEvent, key: string) => void
    toggleAll: () => void
    onKeydown: (event: KeyboardEvent) => void
    openMenuAt: (x: number, y: number, key: string) => void
    onAction: (action: string) => void
    restoreFocus: () => void
}

type TTableHarness = {
    table: TDataTableInstance
    scroller: HTMLDivElement
    thead: HTMLTableSectionElement
    tbody: HTMLTableSectionElement
    syncDom: () => void
    setViewport: (height: number, headerHeight?: number) => void
    destroy: () => void
}

const createTable = (options?: {
    rows?: TRow[]
    selectable?: boolean
    density?: TUiTableDensity
    actions?: TUiMenuItem[]
}): TTableHarness => {
    const scroller = document.createElement('div')
    const tableEl = document.createElement('table')
    const thead = document.createElement('thead')
    const tbody = document.createElement('tbody')
    tableEl.appendChild(thead)
    tableEl.appendChild(tbody)
    scroller.appendChild(tableEl)
    document.body.appendChild(scroller)

    const instance = new (UiDataTable as unknown as new () => TDataTableInstance)()
    instance.columns = columns
    instance.rows = options?.rows ?? makeRows(200)
    instance.rowKey = 'id'
    instance.label = 'Pods'
    instance.sort = null
    instance.selected = []
    instance.cursor = null
    instance.selectable = options?.selectable ?? true
    instance.density = options?.density ?? 'compact'
    instance.actions = options?.actions ?? []
    instance.$refs = { scroller }
    instance.$emit = vi.fn((event: string, payload: unknown) => {
        if (event === 'update:selected') {
            instance.selected = payload as string[]
        } else if (event === 'update:cursor') {
            instance.cursor = payload as string | null
        }
    })

    const syncDom = (): void => {
        tbody.innerHTML = ''
        const window = instance.virtualWindow
        if (window.topSpacerPx > 0) {
            const tr = document.createElement('tr')
            tr.className = 'ui-virtual-spacer'
            tbody.appendChild(tr)
        }
        for (const entry of instance.visibleEntries) {
            const tr = document.createElement('tr')
            tr.setAttribute('data-row-key', entry.key)
            tr.tabIndex = -1
            tbody.appendChild(tr)
        }
        if (window.bottomSpacerPx > 0) {
            const tr = document.createElement('tr')
            tr.className = 'ui-virtual-spacer'
            tbody.appendChild(tr)
        }
    }

    const setViewport = (height: number, headerHeight = 28): void => {
        Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: height })
        Object.defineProperty(thead, 'offsetHeight', { configurable: true, value: headerHeight })
        for (const observer of FakeResizeObserver.instances) {
            observer.trigger()
        }
        syncDom()
    }

    instance.mounted()
    syncDom()

    return {
        table: instance,
        scroller,
        thead,
        tbody,
        syncDom,
        setViewport,
        destroy: () => {
            instance.beforeUnmount()
            scroller.remove()
        },
    }
}

describe('UiDataTable virtualization', () => {
    const originalResizeObserver = globalThis.ResizeObserver
    const originalRaf = globalThis.requestAnimationFrame
    const originalCaf = globalThis.cancelAnimationFrame
    let rafQueue: Array<{ id: number; callback: FrameRequestCallback }> = []
    let nextRafId = 1
    let harness: TTableHarness | null = null

    const flushRaf = (): void => {
        const batch = rafQueue
        rafQueue = []
        for (const entry of batch) {
            entry.callback(performance.now())
        }
    }

    beforeEach(() => {
        FakeResizeObserver.instances = []
        rafQueue = []
        nextRafId = 1
        globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver
        globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
            const id = nextRafId++
            rafQueue.push({ id, callback })
            return id
        })
        globalThis.cancelAnimationFrame = vi.fn((id: number) => {
            rafQueue = rafQueue.filter(entry => entry.id !== id)
        })
    })

    afterEach(() => {
        harness?.destroy()
        harness = null
        globalThis.ResizeObserver = originalResizeObserver
        globalThis.requestAnimationFrame = originalRaf
        globalThis.cancelAnimationFrame = originalCaf
    })

    it('falls back to rendering all rows when clientHeight is 0 or row count is at most 80', () => {
        harness = createTable({ rows: makeRows(150) })

        expect(harness.table.virtualWindow.active).toBe(false)
        expect(harness.table.visibleEntries.length).toBe(150)

        harness.table.rows = makeRows(80)
        harness.setViewport(280, 28)

        expect(harness.table.virtualWindow.active).toBe(false)
        expect(harness.table.visibleEntries.length).toBe(80)
        expect(harness.table.virtualWindow.topSpacerPx).toBe(0)
        expect(harness.table.virtualWindow.bottomSpacerPx).toBe(0)
    })

    it('computes windowed visibleEntries with absolute indices and keys when active', () => {
        harness = createTable({ rows: makeRows(500) })
        harness.setViewport(280, 28)

        expect(harness.table.virtualWindow).toEqual({
            active: true,
            startIndex: 0,
            endIndex: 22,
            topSpacerPx: 0,
            bottomSpacerPx: (500 - 22) * 28,
            rowHeightPx: 28,
        })
        expect(harness.table.visibleEntries.length).toBe(22)
        expect(harness.table.visibleEntries[0]).toEqual({ row: harness.table.rows[0], key: 'row-0', index: 0 })
        expect(harness.table.visibleEntries[21]).toEqual({ row: harness.table.rows[21], key: 'row-21', index: 21 })
    })

    it('coalesces rapid scroll events per animation frame and updates spacers', () => {
        harness = createTable({ rows: makeRows(500) })
        harness.setViewport(280, 28)

        harness.scroller.scrollTop = 700
        harness.scroller.dispatchEvent(new Event('scroll'))
        harness.scroller.scrollTop = 1400
        harness.scroller.dispatchEvent(new Event('scroll'))
        harness.scroller.scrollTop = 2800
        harness.scroller.dispatchEvent(new Event('scroll'))

        expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1)
        expect(harness.table.scrollTop).toBe(0)

        flushRaf()

        expect(harness.table.scrollTop).toBe(2800)
        expect(harness.table.virtualWindow).toEqual({
            active: true,
            startIndex: 88,
            endIndex: 122,
            topSpacerPx: 88 * 28,
            bottomSpacerPx: (500 - 122) * 28,
            rowHeightPx: 28,
        })
        expect(harness.table.visibleEntries[0].index).toBe(88)
        expect(harness.table.visibleEntries[0].key).toBe('row-88')
        expect(harness.table.visibleEntries[harness.table.visibleEntries.length - 1].key).toBe('row-121')
    })

    it('preserves Shift+Click range selection across offscreen virtualized rows and full select-all', () => {
        harness = createTable({ rows: makeRows(300), selectable: true })
        harness.setViewport(280, 28)

        harness.table.onSelectClick(new MouseEvent('click'), 'row-2')
        expect(harness.table.selected).toEqual(['row-2'])

        harness.scroller.scrollTop = 150 * 28
        harness.scroller.dispatchEvent(new Event('scroll'))
        flushRaf()

        expect(harness.table.visibleEntries.some(entry => entry.key === 'row-2')).toBe(false)
        expect(harness.table.visibleEntries.some(entry => entry.key === 'row-152')).toBe(true)

        harness.table.onSelectClick(new MouseEvent('click', { shiftKey: true }), 'row-152')

        expect(harness.table.selected.length).toBe(151)
        expect(harness.table.selected[0]).toBe('row-2')
        expect(harness.table.selected[harness.table.selected.length - 1]).toBe('row-152')

        harness.table.toggleAll()
        expect(harness.table.selected.length).toBe(300)
    })

    it('scrolls to offscreen rows before focusing them on End, Home, and ArrowDown', async () => {
        harness = createTable({ rows: makeRows(400) })
        harness.setViewport(280, 28)

        harness.table.onKeydown(new KeyboardEvent('keydown', { key: 'End', cancelable: true }))
        const expectedEndScroll = 28 + 400 * 28 - 280
        expect(harness.scroller.scrollTop).toBe(expectedEndScroll)
        expect(harness.table.scrollTop).toBe(expectedEndScroll)
        expect(harness.table.cursor).toBe('row-399')

        harness.syncDom()
        await nextTick()

        const lastRow = harness.tbody.querySelector('tr[data-row-key="row-399"]')
        expect(lastRow).not.toBeNull()
        expect(document.activeElement).toBe(lastRow)

        harness.table.onKeydown(new KeyboardEvent('keydown', { key: 'Home', cancelable: true }))
        expect(harness.scroller.scrollTop).toBe(0)
        expect(harness.table.cursor).toBe('row-0')

        harness.syncDom()
        await nextTick()

        const firstRow = harness.tbody.querySelector('tr[data-row-key="row-0"]')
        expect(firstRow).not.toBeNull()
        expect(document.activeElement).toBe(firstRow)

        harness.table.cursor = 'row-8'
        harness.table.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }))
        expect(harness.table.cursor).toBe('row-9')
        expect(harness.scroller.scrollTop).toBe(28)
    })

    it('clamps scrollTop when rows shrink and updates measurements on density change', async () => {
        harness = createTable({ rows: makeRows(400), density: 'compact' })
        harness.setViewport(280, 28)

        harness.scroller.scrollTop = 9000
        harness.scroller.dispatchEvent(new Event('scroll'))
        flushRaf()

        harness.table.rows = makeRows(100)
        harness.table.rowsChanged()

        const expectedClamped = 28 + 100 * 28 - 280
        expect(harness.table.scrollTop).toBe(expectedClamped)
        expect(harness.scroller.scrollTop).toBe(expectedClamped)
        expect(harness.table.visibleEntries.length).toBeGreaterThan(0)

        harness.table.density = 'comfortable'
        Object.defineProperty(harness.thead, 'offsetHeight', { configurable: true, value: 36 })
        harness.table.densityChanged()
        await nextTick()

        expect(harness.table.headerHeight).toBe(36)
        expect(harness.table.virtualWindow.rowHeightPx).toBe(UiTableVirtualizer.comfortableRowHeightPx)
    })

    it('preserves context menu open, action emission, and focus restore on scrolled rows', async () => {
        harness = createTable({
            rows: makeRows(300),
            actions: [{ key: 'delete', label: 'Delete' }],
        })
        harness.setViewport(280, 28)

        harness.scroller.scrollTop = 200 * 28
        harness.scroller.dispatchEvent(new Event('scroll'))
        flushRaf()
        harness.syncDom()

        harness.table.openMenuAt(50, 60, 'row-205')
        expect(harness.table.menuOpen).toBe(true)
        expect(harness.table.menuRowKey).toBe('row-205')
        expect(harness.table.cursor).toBe('row-205')

        harness.table.onAction('delete')
        expect(harness.table.$emit).toHaveBeenCalledWith('action', {
            action: 'delete',
            row: harness.table.rows[205],
        })

        harness.table.restoreFocus()
        await nextTick()
        expect(harness.table.menuRowKey).toBeNull()
        expect(document.activeElement).toBe(harness.tbody.querySelector('tr[data-row-key="row-205"]'))
    })

    it('cancels pending scroll rAF, removes scroll listener, and disconnects ResizeObserver on unmount', () => {
        harness = createTable({ rows: makeRows(200) })
        harness.setViewport(280, 28)

        harness.scroller.scrollTop = 400
        harness.scroller.dispatchEvent(new Event('scroll'))
        expect(rafQueue.length).toBe(1)

        const observer = FakeResizeObserver.instances[0]
        const scroller = harness.scroller
        harness.destroy()
        harness = null

        expect(observer.disconnected).toBe(true)
        expect(globalThis.cancelAnimationFrame).toHaveBeenCalledTimes(1)
        expect(rafQueue.length).toBe(0)

        scroller.scrollTop = 800
        scroller.dispatchEvent(new Event('scroll'))
        expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1)
    })
})
