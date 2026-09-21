import { ChartTokens } from '@/application/services/chart/constants/ChartTokens'
import type { TChartTheme } from '@/application/services/chart/types/TChartTheme'

export class ChartTheme {
    private static readonly fallbackColour: string = '#7f7f7f'

    private static readonly fallbackFont: string = 'system-ui, sans-serif'

    public static build(values: Record<string, string>): TChartTheme {
        return {
            axis: ChartTheme.colour(values, ChartTokens.axis),
            grid: ChartTheme.colour(values, ChartTokens.grid),
            cursor: ChartTheme.colour(values, ChartTokens.cursor),
            series: ChartTokens.series().map(token => ChartTheme.colour(values, token)),
            font: values[ChartTokens.fontSans] ?? ChartTheme.fallbackFont,
        }
    }

    public static colourAt(theme: TChartTheme, index: number): string {
        return theme.series.length > 0
            ? theme.series[index % theme.series.length]
            : ChartTheme.fallbackColour
    }

    // The tokens hold bare HSL components for Tailwind to wrap; a canvas needs them wrapped.
    private static colour(values: Record<string, string>, token: string): string {
        const value = values[token]

        return value ? `hsl(${value})` : ChartTheme.fallbackColour
    }
}
