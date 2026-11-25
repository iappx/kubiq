import { describe, expect, it } from 'vitest'
import { UiTableVirtualizer } from '@/components/common/table/UiTableVirtualizer'

describe('UiTableVirtualizer', () => {
    it('exposes the fixed density heights and window defaults', () => {
        expect(UiTableVirtualizer.compactRowHeightPx).toBe(28)
        expect(UiTableVirtualizer.comfortableRowHeightPx).toBe(36)
        expect(UiTableVirtualizer.activationThreshold).toBe(80)
        expect(UiTableVirtualizer.defaultOverscan).toBe(12)
        expect(UiTableVirtualizer.rowHeight('compact')).toBe(28)
        expect(UiTableVirtualizer.rowHeight('comfortable')).toBe(36)
        expect(UiTableVirtualizer.rowHeight(undefined)).toBe(28)
    })

    it('stays inactive at or below the activation threshold', () => {
        for (const totalRows of [0, 1, 79, 80]) {
            const window = UiTableVirtualizer.compute({
                totalRows,
                scrollTop: 500,
                viewportHeight: 280,
                density: 'compact',
            })

            expect(window).toEqual({
                active: false,
                startIndex: 0,
                endIndex: totalRows,
                topSpacerPx: 0,
                bottomSpacerPx: 0,
                rowHeightPx: 28,
            })
        }
    })

    it('stays inactive when viewport height is zero or negative', () => {
        const window = UiTableVirtualizer.compute({
            totalRows: 500,
            scrollTop: 0,
            viewportHeight: 0,
            density: 'comfortable',
        })

        expect(window).toEqual({
            active: false,
            startIndex: 0,
            endIndex: 500,
            topSpacerPx: 0,
            bottomSpacerPx: 0,
            rowHeightPx: 36,
        })
    })

    it('computes start, end, and spacers at the top, middle, and bottom for compact rows', () => {
        const top = UiTableVirtualizer.compute({
            totalRows: 200,
            scrollTop: 0,
            viewportHeight: 280,
            density: 'compact',
        })
        expect(top).toEqual({
            active: true,
            startIndex: 0,
            endIndex: 22,
            topSpacerPx: 0,
            bottomSpacerPx: 178 * 28,
            rowHeightPx: 28,
        })

        const middle = UiTableVirtualizer.compute({
            totalRows: 200,
            scrollTop: 1400,
            viewportHeight: 280,
            density: 'compact',
        })
        expect(middle).toEqual({
            active: true,
            startIndex: 38,
            endIndex: 72,
            topSpacerPx: 38 * 28,
            bottomSpacerPx: 128 * 28,
            rowHeightPx: 28,
        })

        const bottom = UiTableVirtualizer.compute({
            totalRows: 200,
            scrollTop: 5348,
            viewportHeight: 280,
            density: 'compact',
        })
        expect(bottom).toEqual({
            active: true,
            startIndex: 178,
            endIndex: 200,
            topSpacerPx: 178 * 28,
            bottomSpacerPx: 0,
            rowHeightPx: 28,
        })
    })

    it('computes windows using 36px rows for comfortable density and custom overscan', () => {
        const window = UiTableVirtualizer.compute({
            totalRows: 300,
            scrollTop: 3600,
            viewportHeight: 360,
            density: 'comfortable',
            overscan: 4,
        })

        expect(window).toEqual({
            active: true,
            startIndex: 96,
            endIndex: 114,
            topSpacerPx: 96 * 36,
            bottomSpacerPx: 186 * 36,
            rowHeightPx: 36,
        })
    })

    it('preserves exact total height across negative and past-end scroll offsets', () => {
        for (const scrollTop of [-500, 0, 1234, 999999]) {
            const window = UiTableVirtualizer.compute({
                totalRows: 250,
                scrollTop,
                viewportHeight: 300,
                density: 'compact',
            })

            expect(window.active).toBe(true)
            expect(window.startIndex).toBeGreaterThanOrEqual(0)
            expect(window.endIndex).toBeLessThanOrEqual(250)
            expect(window.startIndex).toBeLessThanOrEqual(window.endIndex)
            const renderedHeight = (window.endIndex - window.startIndex) * window.rowHeightPx
            expect(window.topSpacerPx + renderedHeight + window.bottomSpacerPx).toBe(250 * 28)
        }
    })

    it('returns null from scrollTopForIndex when a row is already fully visible below the sticky header', () => {
        expect(UiTableVirtualizer.scrollTopForIndex({
            index: 0,
            rowHeightPx: 28,
            scrollTop: 0,
            viewportHeight: 280,
            headerHeightPx: 28,
        })).toBeNull()

        expect(UiTableVirtualizer.scrollTopForIndex({
            index: 8,
            rowHeightPx: 28,
            scrollTop: 0,
            viewportHeight: 280,
            headerHeightPx: 28,
        })).toBeNull()

        expect(UiTableVirtualizer.scrollTopForIndex({
            index: 5,
            rowHeightPx: 28,
            scrollTop: 140,
            viewportHeight: 280,
            headerHeightPx: 28,
        })).toBeNull()
    })

    it('scrolls up to reveal a row hidden above or under the sticky header', () => {
        expect(UiTableVirtualizer.scrollTopForIndex({
            index: 0,
            rowHeightPx: 28,
            scrollTop: 140,
            viewportHeight: 280,
            headerHeightPx: 28,
        })).toBe(0)

        expect(UiTableVirtualizer.scrollTopForIndex({
            index: 5,
            rowHeightPx: 28,
            scrollTop: 150,
            viewportHeight: 280,
            headerHeightPx: 28,
        })).toBe(140)
    })

    it('scrolls down accounting for sticky header height when a row is below the viewport', () => {
        expect(UiTableVirtualizer.scrollTopForIndex({
            index: 9,
            rowHeightPx: 28,
            scrollTop: 0,
            viewportHeight: 280,
            headerHeightPx: 28,
        })).toBe(28)

        expect(UiTableVirtualizer.scrollTopForIndex({
            index: 499,
            rowHeightPx: 36,
            scrollTop: 0,
            viewportHeight: 360,
            headerHeightPx: 36,
        })).toBe(36 + 500 * 36 - 360)
    })

    it('aligns the row top under the header when viewport is shorter than header plus one row', () => {
        expect(UiTableVirtualizer.scrollTopForIndex({
            index: 5,
            rowHeightPx: 28,
            scrollTop: 0,
            viewportHeight: 40,
            headerHeightPx: 28,
        })).toBe(140)
    })

    it('returns null from scrollTopForIndex on invalid arguments', () => {
        expect(UiTableVirtualizer.scrollTopForIndex({
            index: -1,
            rowHeightPx: 28,
            scrollTop: 0,
            viewportHeight: 280,
            headerHeightPx: 28,
        })).toBeNull()

        expect(UiTableVirtualizer.scrollTopForIndex({
            index: 5,
            rowHeightPx: 28,
            scrollTop: 0,
            viewportHeight: 0,
            headerHeightPx: 28,
        })).toBeNull()
    })

    it('clamps scrollTop safely when the row list shrinks', () => {
        expect(UiTableVirtualizer.clampScrollTop({
            totalRows: 50,
            scrollTop: 10000,
            viewportHeight: 280,
            headerHeightPx: 28,
            rowHeightPx: 28,
        })).toBe(28 + 50 * 28 - 280)

        expect(UiTableVirtualizer.clampScrollTop({
            totalRows: 5,
            scrollTop: 1000,
            viewportHeight: 280,
            headerHeightPx: 28,
            rowHeightPx: 28,
        })).toBe(0)

        expect(UiTableVirtualizer.clampScrollTop({
            totalRows: 500,
            scrollTop: -50,
            viewportHeight: 280,
            headerHeightPx: 28,
            rowHeightPx: 28,
        })).toBe(0)
    })
})
