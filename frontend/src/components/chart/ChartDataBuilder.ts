import type uPlot from 'uplot'
import type { TMetricSeries } from '@/domain/models/metrics'

export class ChartDataBuilder {
    // uPlot draws one shared x axis, so every series is projected onto the union of
    // the timestamps and a gap becomes null rather than a zero the eye reads as a dip.
    public static align(series: readonly TMetricSeries[]): uPlot.AlignedData {
        const stamps = ChartDataBuilder.stamps(series)
        const columns = series.map(entry => ChartDataBuilder.column(entry, stamps))

        return [stamps, ...columns] as unknown as uPlot.AlignedData
    }

    private static stamps(series: readonly TMetricSeries[]): number[] {
        const unique = new Set<number>()
        series.forEach(entry => entry.points.forEach(point => unique.add(Math.round(point.at / 1000))))

        return [...unique].sort((left, right) => left - right)
    }

    private static column(series: TMetricSeries, stamps: readonly number[]): (number | null)[] {
        const byStamp = new Map<number, number>()
        series.points.forEach(point => byStamp.set(Math.round(point.at / 1000), point.value))

        return stamps.map(stamp => byStamp.get(stamp) ?? null)
    }
}
