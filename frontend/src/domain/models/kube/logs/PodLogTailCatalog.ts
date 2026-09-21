export class PodLogTailCatalog {
    public static readonly values: Record<string, string> = {
        '100': 'Last 100 lines',
        '500': 'Last 500 lines',
        '1000': 'Last 1 000 lines',
        '5000': 'Last 5 000 lines',
        '0': 'Everything the cluster still holds',
    }

    public static title(tailLines: number): string {
        return PodLogTailCatalog.values[String(tailLines)] ?? `Last ${tailLines} lines`
    }

    public static has(tailLines: number): boolean {
        return Object.prototype.hasOwnProperty.call(PodLogTailCatalog.values, String(tailLines))
    }
}
