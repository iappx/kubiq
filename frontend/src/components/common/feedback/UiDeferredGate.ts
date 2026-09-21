export class UiDeferredGate {
    public static readonly defaultDelayMs = 300

    private timer: ReturnType<typeof setTimeout> | null = null

    public start(delayMs: number, reveal: () => void): void {
        this.cancel()
        this.timer = setTimeout(() => {
            this.timer = null
            reveal()
        }, delayMs)
    }

    public cancel(): void {
        if (this.timer !== null) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }

    public get pending(): boolean {
        return this.timer !== null
    }
}
