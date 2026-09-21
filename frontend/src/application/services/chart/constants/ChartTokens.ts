export class ChartTokens {
    public static readonly axis: string = '--muted-foreground'

    public static readonly grid: string = '--border'

    public static readonly cursor: string = '--primary'

    public static readonly fontSans: string = '--font-sans'

    public static readonly seriesCount: number = 6

    public static series(): string[] {
        return Array.from({ length: ChartTokens.seriesCount }, (_, index) => `--chart-${index + 1}`)
    }

    public static all(): string[] {
        return [ChartTokens.axis, ChartTokens.grid, ChartTokens.cursor, ChartTokens.fontSans, ...ChartTokens.series()]
    }
}
