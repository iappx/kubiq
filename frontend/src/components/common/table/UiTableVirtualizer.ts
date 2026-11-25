import type { TUiTableDensity } from '@/components/common/table/types/TUiTableDensity'
import type { TUiVirtualWindow } from '@/components/common/table/types/TUiVirtualWindow'

export class UiTableVirtualizer {
    public static readonly compactRowHeightPx = 28

    public static readonly comfortableRowHeightPx = 36

    public static readonly activationThreshold = 80

    public static readonly defaultOverscan = 12

    public static rowHeight(density?: TUiTableDensity): number {
        return density === 'comfortable'
            ? UiTableVirtualizer.comfortableRowHeightPx
            : UiTableVirtualizer.compactRowHeightPx
    }

    public static compute(params: {
        totalRows: number
        scrollTop: number
        viewportHeight: number
        density?: TUiTableDensity
        overscan?: number
    }): TUiVirtualWindow {
        const rowHeightPx = UiTableVirtualizer.rowHeight(params.density)
        const totalRows = Math.max(0, Math.floor(params.totalRows))

        if (totalRows <= UiTableVirtualizer.activationThreshold || params.viewportHeight <= 0) {
            return {
                active: false,
                startIndex: 0,
                endIndex: totalRows,
                topSpacerPx: 0,
                bottomSpacerPx: 0,
                rowHeightPx,
            }
        }

        const overscan = Math.max(0, Math.floor(params.overscan ?? UiTableVirtualizer.defaultOverscan))
        const visibleCount = Math.ceil(params.viewportHeight / rowHeightPx)
        const maxFirstVisible = Math.max(0, totalRows - visibleCount)
        const firstVisible = Math.min(maxFirstVisible, Math.floor(Math.max(0, params.scrollTop) / rowHeightPx))
        const startIndex = Math.max(0, firstVisible - overscan)
        const endIndex = Math.min(totalRows, firstVisible + visibleCount + overscan)

        return {
            active: true,
            startIndex,
            endIndex,
            topSpacerPx: startIndex * rowHeightPx,
            bottomSpacerPx: (totalRows - endIndex) * rowHeightPx,
            rowHeightPx,
        }
    }

    public static scrollTopForIndex(params: {
        index: number
        rowHeightPx: number
        scrollTop: number
        viewportHeight: number
        headerHeightPx: number
    }): number | null {
        const { index, rowHeightPx, viewportHeight } = params
        if (index < 0 || rowHeightPx <= 0 || viewportHeight <= 0) {
            return null
        }

        const currentScrollTop = Math.max(0, params.scrollTop)
        const headerHeight = Math.max(0, params.headerHeightPx)
        const rowTop = index * rowHeightPx
        if (rowTop < currentScrollTop) {
            return rowTop
        }

        const rowBottom = headerHeight + (index + 1) * rowHeightPx
        if (rowBottom > currentScrollTop + viewportHeight) {
            return Math.max(0, Math.min(rowTop, rowBottom - viewportHeight))
        }

        return null
    }

    public static clampScrollTop(params: {
        totalRows: number
        scrollTop: number
        viewportHeight: number
        headerHeightPx: number
        rowHeightPx: number
    }): number {
        const totalRows = Math.max(0, Math.floor(params.totalRows))
        const headerHeight = Math.max(0, params.headerHeightPx)
        const totalHeight = headerHeight + totalRows * Math.max(0, params.rowHeightPx)
        const maxScrollTop = Math.max(0, totalHeight - Math.max(0, params.viewportHeight))
        return Math.min(Math.max(0, params.scrollTop), maxScrollTop)
    }
}
