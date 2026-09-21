export class UiFlashController {
    public static readonly defaultDurationMs = 600

    public static readonly defaultBurstLimit = 8

    public static readonly defaultWindowMs = 1000

    private readonly events: number[] = []

    private readonly expiry = new Map<string, number>()

    constructor(
        private readonly durationMs: number = UiFlashController.defaultDurationMs,
        private readonly burstLimit: number = UiFlashController.defaultBurstLimit,
        private readonly windowMs: number = UiFlashController.defaultWindowMs,
    ) {}

    public flash(keys: readonly string[], now: number): boolean {
        this.prune(now)
        this.forgetStaleEvents(now)
        this.events.push(now)

        if (this.events.length > this.burstLimit) {
            this.expiry.clear()
            return false
        }

        for (const key of keys) {
            this.expiry.set(key, now + this.durationMs)
        }
        return true
    }

    public prune(now: number): boolean {
        let changed = false
        for (const [key, expiresAt] of this.expiry) {
            if (expiresAt <= now) {
                this.expiry.delete(key)
                changed = true
            }
        }
        return changed
    }

    public has(key: string, now: number): boolean {
        const expiresAt = this.expiry.get(key)
        return expiresAt !== undefined && expiresAt > now
    }

    public keys(): string[] {
        return [...this.expiry.keys()]
    }

    public isSuppressed(now: number): boolean {
        return this.eventsWithin(now) > this.burstLimit
    }

    public get active(): boolean {
        return this.expiry.size > 0
    }

    public clear(): void {
        this.events.length = 0
        this.expiry.clear()
    }

    private eventsWithin(now: number): number {
        const since = now - this.windowMs
        let count = 0
        for (const at of this.events) {
            if (at > since) {
                count++
            }
        }
        return count
    }

    private forgetStaleEvents(now: number): void {
        const since = now - this.windowMs
        while (this.events.length > 0 && this.events[0] <= since) {
            this.events.shift()
        }
    }
}
