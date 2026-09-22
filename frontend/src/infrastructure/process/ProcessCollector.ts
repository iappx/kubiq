import type { IProcessSink } from '@/infrastructure/process/types/IProcessSink'
import type { TProcessOutcome } from '@/infrastructure/process/types/TProcessOutcome'

export class ProcessCollector implements IProcessSink {
    public static readonly expiredCode: number = -3

    private readonly out: string[] = []

    private readonly err: string[] = []

    private code: number = 0

    private settle: (() => void) | null = null

    private timer: ReturnType<typeof setTimeout> | null = null

    private readonly done: Promise<void>

    constructor(timeoutMs: number = 0) {
        this.done = new Promise<void>((resolve) => {
            this.settle = resolve
        })

        if (timeoutMs > 0) {
            this.timer = setTimeout(() => this.finish(ProcessCollector.expiredCode), timeoutMs)
        }
    }

    public onOutput(text: string, isError: boolean): void {
        (isError ? this.err : this.out).push(text)
    }

    public onExit(code: number): void {
        this.finish(code)
    }

    public async outcome(): Promise<TProcessOutcome> {
        await this.done

        return { code: this.code, stdout: this.out.join(''), stderr: this.err.join('') }
    }

    private finish(code: number): void {
        if (this.settle === null) {
            return
        }

        if (this.timer !== null) {
            clearTimeout(this.timer)
            this.timer = null
        }

        this.code = code
        this.settle()
        this.settle = null
    }
}
