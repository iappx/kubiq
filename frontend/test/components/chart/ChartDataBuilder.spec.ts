import { describe, expect, it } from 'vitest'
import { ChartAxisScale } from '@/components/chart/ChartAxisScale'
import { ChartDataBuilder } from '@/components/chart/ChartDataBuilder'
import type { TMetricSeries } from '@/domain/models/metrics'

const series = (key: string, points: [number, number][]): TMetricSeries => ({
    key,
    label: key,
    points: points.map(([at, value]) => ({ at, value })),
})

describe('ChartDataBuilder', () => {
    it('puts the timestamps in seconds, which is what the plotter counts in', () => {
        const data = ChartDataBuilder.align([series('a', [[1700000000000, 1], [1700000030000, 2]])])

        expect(data[0]).toEqual([1700000000, 1700000030])
        expect(data[1]).toEqual([1, 2])
    })

    // One shared x axis means a series that was not scraped at some instant has to
    // carry a hole there, and a zero would read as a dip rather than a gap.
    it('projects every series onto the union of the timestamps and holes the rest', () => {
        const data = ChartDataBuilder.align([
            series('a', [[1000, 1], [3000, 3]]),
            series('b', [[2000, 2]]),
        ])

        expect(data[0]).toEqual([1, 2, 3])
        expect(data[1]).toEqual([1, null, 3])
        expect(data[2]).toEqual([null, 2, null])
    })

    it('sorts the axis whatever order the series arrived in', () => {
        const data = ChartDataBuilder.align([series('a', [[3000, 3], [1000, 1]])])

        expect(data[0]).toEqual([1, 3])
        expect(data[1]).toEqual([1, 3])
    })

    it('answers an axis and nothing else for no series at all', () => {
        expect(ChartDataBuilder.align([])).toEqual([[]])
    })
})

describe('ChartAxisScale', () => {
    it('labels a tick with the wall clock, zero padded', () => {
        const at = new Date(2026, 0, 2, 9, 5, 0).getTime() / 1000

        expect(ChartAxisScale.timeLabel(at)).toBe('09:05')
    })

    it('labels nothing for a tick that is not a number', () => {
        expect(ChartAxisScale.timeLabel(null)).toBe('')
        expect(ChartAxisScale.timeLabel(Number.NaN)).toBe('')
    })
})
