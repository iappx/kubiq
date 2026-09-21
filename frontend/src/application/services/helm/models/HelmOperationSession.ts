import { HelmOutputBuffer } from '@/application/services/helm/models/HelmOutputBuffer'
import type { IHelmOperationSink } from '@/application/services/helm/types/IHelmOperationSink'
import type { IHelmOutputHandler } from '@/infrastructure/entityRepo/helm/transport/types/IHelmOutputHandler'
import type { ProcessRun } from '@/infrastructure/process/ProcessRun'

export class HelmOperationSession implements IHelmOutputHandler {
    public readonly buffer = new HelmOutputBuffer()

    private run: ProcessRun | null = null

    private cancelled: boolean = false

    constructor(
        public readonly key: string,
        private readonly sink: IHelmOperationSink,
    ) {}

    public get wasCancelled(): boolean {
        return this.cancelled
    }

    public attach(run: ProcessRun): void {
        this.run = run
    }

    public onOutput(text: string, isError: boolean): void {
        this.buffer.append(text)
        this.sink.onOperationOutput(this.key, this.buffer.count)
    }

    public onExit(code: number): void {
        this.buffer.flush()
        this.sink.onOperationFinished(this.key, code)
    }

    public async cancel(): Promise<void> {
        this.cancelled = true
        await this.run?.kill()
    }
}
