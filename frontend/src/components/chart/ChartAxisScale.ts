export class ChartAxisScale {
    public static timeLabel(seconds: number | null): string {
        if (seconds === null || !Number.isFinite(seconds)) {
            return ''
        }

        const moment = new Date(seconds * 1000)

        return `${ChartAxisScale.pad(moment.getHours())}:${ChartAxisScale.pad(moment.getMinutes())}`
    }

    private static pad(value: number): string {
        return value < 10 ? `0${value}` : String(value)
    }
}
