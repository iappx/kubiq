export class HelmTimeouts {
    public static readonly readMs: number = 30_000

    public static readonly probeMs: number = 10_000

    public static seconds(milliseconds: number): number {
        return Math.round(milliseconds / 1000)
    }
}
