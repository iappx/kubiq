export class UiAgeFormatter {
    private static readonly minute = 60

    private static readonly hour = 3600

    private static readonly day = 86400

    // Thresholds are kubectl's duration.HumanDuration, so the column reads exactly like `kubectl get`.
    public static format(fromMs: number, nowMs: number): string {
        const seconds = Math.floor((nowMs - fromMs) / 1000)
        if (seconds < 0) {
            return '0s'
        }
        if (seconds < UiAgeFormatter.minute * 2) {
            return `${seconds}s`
        }

        const minutes = Math.floor(seconds / UiAgeFormatter.minute)
        if (minutes < 10) {
            const rest = seconds % UiAgeFormatter.minute
            return rest === 0 ? `${minutes}m` : `${minutes}m${rest}s`
        }
        if (minutes < UiAgeFormatter.minute * 3) {
            return `${minutes}m`
        }

        const hours = Math.floor(seconds / UiAgeFormatter.hour)
        if (hours < 8) {
            const rest = minutes % 60
            return rest === 0 ? `${hours}h` : `${hours}h${rest}m`
        }
        if (hours < 48) {
            return `${hours}h`
        }

        const days = Math.floor(seconds / UiAgeFormatter.day)
        if (hours < 24 * 8) {
            const rest = hours % 24
            return rest === 0 ? `${days}d` : `${days}d${rest}h`
        }
        if (hours < 24 * 365 * 2) {
            return `${days}d`
        }

        const years = Math.floor(days / 365)
        const rest = days % 365
        if (hours < 24 * 365 * 8 && rest !== 0) {
            return `${years}y${rest}d`
        }
        return `${years}y`
    }

    public static parse(value: string | number | Date | null | undefined): number | null {
        if (value === null || value === undefined || value === '') {
            return null
        }
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value.getTime()
        }
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null
        }

        const parsed = Date.parse(value)
        return Number.isNaN(parsed) ? null : parsed
    }
}
