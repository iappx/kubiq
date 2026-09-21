export class UiAgeTicker {
    public static readonly intervalMs = 1000

    private static readonly listeners = new Set<() => void>()

    private static timer: ReturnType<typeof setInterval> | null = null

    public static subscribe(listener: () => void): void {
        UiAgeTicker.listeners.add(listener)
        if (UiAgeTicker.timer === null) {
            UiAgeTicker.timer = setInterval(() => UiAgeTicker.tick(), UiAgeTicker.intervalMs)
        }
    }

    public static unsubscribe(listener: () => void): void {
        UiAgeTicker.listeners.delete(listener)
        if (UiAgeTicker.listeners.size === 0 && UiAgeTicker.timer !== null) {
            clearInterval(UiAgeTicker.timer)
            UiAgeTicker.timer = null
        }
    }

    public static get count(): number {
        return UiAgeTicker.listeners.size
    }

    public static get running(): boolean {
        return UiAgeTicker.timer !== null
    }

    private static tick(): void {
        for (const listener of [...UiAgeTicker.listeners]) {
            listener()
        }
    }
}
