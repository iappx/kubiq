export class PodDebugDefaults {
    public static readonly containerPrefix: string = 'debugger-'

    public static readonly maxNameLength: number = 63

    public static readonly pollIntervalMs: number = 500

    public static readonly readyTimeoutMs: number = 60_000

    public static readonly strategicMergePatchType: string = 'application/strategic-merge-patch+json'
}
