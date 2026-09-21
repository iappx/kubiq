export class ResourceWatchLimits {
    public static readonly flushIntervalMs: number = 100

    public static readonly maxPendingChanges: number = 10000

    public static readonly minimumLifetimeMs: number = 1000

    public static readonly maxConsecutiveFlaps: number = 3

    public static readonly retryBaseDelayMs: number = 500

    public static readonly retryMaxDelayMs: number = 15000
}
