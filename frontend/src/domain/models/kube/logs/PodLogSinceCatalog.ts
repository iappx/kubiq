export class PodLogSinceCatalog {
    public static readonly values: Record<string, string> = {
        '0': 'No time limit',
        '300': 'Last 5 minutes',
        '900': 'Last 15 minutes',
        '3600': 'Last hour',
        '21600': 'Last 6 hours',
        '86400': 'Last 24 hours',
    }

    public static title(sinceSeconds: number): string {
        return PodLogSinceCatalog.values[String(sinceSeconds)] ?? `Last ${sinceSeconds} seconds`
    }

    public static has(sinceSeconds: number): boolean {
        return Object.prototype.hasOwnProperty.call(PodLogSinceCatalog.values, String(sinceSeconds))
    }
}
