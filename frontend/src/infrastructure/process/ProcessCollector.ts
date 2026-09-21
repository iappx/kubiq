import type { IProcessSink } from '@/infrastructure/process/types/IProcessSink'
import type { TProcessOutcome } from '@/infrastructure/process/types/TProcessOutcome'

export class ProcessCollector implements IProcessSink {
    private readonly out: string[] = []

    private readonly err: string[] = []

    private code: number = 0

    private settle: (() => void) | null = null

    private readonly done: Promise<void>

    constructor() {
        this.done = new Promise<void>((resolve) => {
            this.settle = resolve
        })
    }

    public onOutput(text: string, isError: boolean): void {
        (isError ? this.err : this.out).push(text)
    }

    public onExit(code: number): void {
        this.code = code
        this.settle?.()
        this.settle = null
    }

    public async outcome(): Promise<TProcessOutcome> {
        await this.done

        return { code: this.code, stdout: this.out.join(''), stderr: this.err.join('') }
    }
}
