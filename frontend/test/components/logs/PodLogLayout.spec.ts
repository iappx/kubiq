import { describe, expect, it } from 'vitest'
import { PodLogLayout } from '@/components/logs/PodLogLayout'
import { PodLogView } from '@/components/logs/constants/PodLogView'

const lines = (count: number, text: string = 'x') => Array.from({ length: count }, () => text)

describe('PodLogLayout.rowsOf', () => {
    it('takes one row when the line fits', () => {
        expect(PodLogLayout.rowsOf('short', 80)).toBe(1)
    })

    it('takes as many rows as the line needs when wrapped', () => {
        expect(PodLogLayout.rowsOf('x'.repeat(200), 80)).toBe(3)
    })

    it('takes one row when the width is not known yet', () => {
        expect(PodLogLayout.rowsOf('x'.repeat(200), 0)).toBe(1)
    })
})

describe('PodLogLayout.offsets', () => {
    it('gives every line the same height when lines do not wrap', () => {
        expect(PodLogLayout.offsets(lines(3), 20, 80, false)).toEqual([0, 20, 40, 60])
    })

    it('gives a wrapped line the height of the rows it takes', () => {
        const offsets = PodLogLayout.offsets(['short', 'x'.repeat(160)], 20, 80, true)

        expect(offsets).toEqual([0, 20, 60])
    })

    it('has one more entry than there are lines', () => {
        expect(PodLogLayout.offsets(lines(5), 20, 80, false)).toHaveLength(6)
    })
})

describe('PodLogLayout.window', () => {
    it('renders nothing for an empty log', () => {
        expect(PodLogLayout.window([0], 0, 200, 0)).toEqual({ start: 0, end: 0, offsetTop: 0, totalHeight: 0 })
    })

    it('renders only what the viewport can show, plus the overscan', () => {
        const offsets = PodLogLayout.offsets(lines(1000), 20, 80, false)

        const visible = PodLogLayout.window(offsets, 0, 200, 5)

        expect(visible.start).toBe(0)
        expect(visible.end).toBeLessThan(25)
        expect(visible.totalHeight).toBe(20000)
    })

    it('moves the window down as the log is scrolled', () => {
        const offsets = PodLogLayout.offsets(lines(1000), 20, 80, false)

        const visible = PodLogLayout.window(offsets, 4000, 200, 0)

        expect(visible.start).toBe(200)
        expect(visible.offsetTop).toBe(4000)
    })

    it('keeps the overscan from running past the start', () => {
        const offsets = PodLogLayout.offsets(lines(1000), 20, 80, false)

        const visible = PodLogLayout.window(offsets, 20, 200, PodLogView.overscan)

        expect(visible.start).toBe(0)
        expect(visible.offsetTop).toBe(0)
    })

    it('never asks for a line past the end', () => {
        const offsets = PodLogLayout.offsets(lines(10), 20, 80, false)

        const visible = PodLogLayout.window(offsets, 10000, 200, PodLogView.overscan)

        expect(visible.end).toBe(10)
    })

    it('spaces the window correctly when lines wrap to different heights', () => {
        const offsets = PodLogLayout.offsets(['a', 'x'.repeat(160), 'b', 'c'], 20, 80, true)

        const visible = PodLogLayout.window(offsets, 60, 20, 0)

        expect(visible.start).toBe(2)
        expect(visible.offsetTop).toBe(60)
        expect(visible.totalHeight).toBe(100)
    })
})

describe('PodLogLayout.columnsFor', () => {
    it('divides the width it has by the width of a character', () => {
        expect(PodLogLayout.columnsFor(800, 8, 120)).toBe(100)
    })

    it('falls back until a character has been measured', () => {
        expect(PodLogLayout.columnsFor(800, 0, 120)).toBe(120)
        expect(PodLogLayout.columnsFor(0, 8, 120)).toBe(120)
    })

    it('never reports fewer than one column', () => {
        expect(PodLogLayout.columnsFor(4, 8, 120)).toBe(1)
    })
})
