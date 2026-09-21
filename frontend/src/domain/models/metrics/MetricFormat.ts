import type { TMetricSeriesKind } from '@/domain/models/metrics/types/TMetricSeriesKind'

export class MetricFormat {
    private static readonly byteUnits: readonly string[] = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']

    public static of(kind: TMetricSeriesKind, value: number): string {
        return kind === 'cpu' ? MetricFormat.cores(value) : MetricFormat.bytes(value)
    }

    public static unitOf(kind: TMetricSeriesKind): string {
        return kind === 'cpu' ? 'cores' : 'bytes'
    }

    public static cores(value: number): string {
        if (!Number.isFinite(value) || value <= 0) {
            return '0'
        }
        if (value < 1) {
            return `${Math.round(value * 1000)}m`
        }

        return MetricFormat.trim(value.toFixed(2))
    }

    public static bytes(value: number): string {
        if (!Number.isFinite(value) || value <= 0) {
            return '0'
        }

        let scaled = value
        let unit = 0
        while (scaled >= 1024 && unit < MetricFormat.byteUnits.length - 1) {
            scaled /= 1024
            unit += 1
        }

        const digits = unit === 0 || scaled >= 100 ? 0 : 1

        return `${MetricFormat.trim(scaled.toFixed(digits))} ${MetricFormat.byteUnits[unit]}`
    }

    public static percent(ratio: number): string {
        if (!Number.isFinite(ratio) || ratio <= 0) {
            return '0%'
        }

        return `${Math.round(ratio * 100)}%`
    }

    public static share(used: string, ratio: number): string {
        return ratio > 0 ? `${used} · ${MetricFormat.percent(ratio)}` : used
    }

    private static trim(text: string): string {
        return text.includes('.') ? text.replace(/\.?0+$/, '') : text
    }
}
