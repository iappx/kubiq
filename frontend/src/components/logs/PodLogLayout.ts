import type { TPodLogWindow } from '@/components/logs/types/TPodLogWindow'

export class PodLogLayout {
    // Only correct while the viewport is monospace: the row count is arithmetic, not a measurement.
    public static rowsOf(text: string, columns: number): number {
        if (columns <= 0 || text.length <= columns) {
            return 1
        }

        return Math.ceil(text.length / columns)
    }

    public static offsets(lines: readonly string[], rowHeight: number, columns: number, wrap: boolean): number[] {
        const offsets = new Array<number>(lines.length + 1)
        offsets[0] = 0

        for (let index = 0; index < lines.length; index += 1) {
            const rows = wrap ? PodLogLayout.rowsOf(lines[index], columns) : 1
            offsets[index + 1] = offsets[index] + rows * rowHeight
        }

        return offsets
    }

    public static window(
        offsets: readonly number[],
        scrollTop: number,
        viewportHeight: number,
        overscan: number,
    ): TPodLogWindow {
        const count = Math.max(0, offsets.length - 1)
        if (count === 0) {
            return { start: 0, end: 0, offsetTop: 0, totalHeight: 0 }
        }

        const totalHeight = offsets[count]
        const top = Math.max(0, Math.min(scrollTop, totalHeight))
        const start = Math.max(0, PodLogLayout.indexAt(offsets, top) - overscan)
        const end = Math.min(count, PodLogLayout.indexAt(offsets, top + Math.max(0, viewportHeight)) + 1 + overscan)

        return { start, end, offsetTop: offsets[start], totalHeight }
    }

    public static columnsFor(width: number, charWidth: number, fallback: number): number {
        if (width <= 0 || charWidth <= 0) {
            return fallback
        }

        return Math.max(1, Math.floor(width / charWidth))
    }

    protected static indexAt(offsets: readonly number[], position: number): number {
        let low = 0
        let high = offsets.length - 2

        if (high <= 0) {
            return 0
        }

        while (low < high) {
            const mid = Math.ceil((low + high) / 2)
            if (offsets[mid] <= position) {
                low = mid
            } else {
                high = mid - 1
            }
        }

        return low
    }
}
