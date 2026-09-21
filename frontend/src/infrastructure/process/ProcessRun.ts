import { Events } from '@wailsio/runtime'
import { ProcessService } from '../../../bindings/iappx_k8s_admin/core/services/process'
import type { IProcessSink } from '@/infrastructure/process/types/IProcessSink'
import type { TProcessMessage } from '@/infrastructure/process/types/TProcessMessage'

export class ProcessRun {
    public static readonly stdoutEvent: string = 'process:stdout'

    public static readonly stderrEvent: string = 'process:stderr'

    public static readonly exitEvent: string = 'process:exit'

    public static readonly killedCode: number = -1

    private readonly listeners: (() => void)[] = []

    private readonly pending: TProcessMessage[] = []

    private readonly output = new TextDecoder()

    private readonly errors = new TextDecoder()

    private processId: string = ''

    private finished: boolean = false

    constructor(private readonly sink: IProcessSink) {}

    public get id(): string {
        return this.processId
    }

    public get isFinished(): boolean {
        return this.finished
    }

    public listen(): void {
        this.listeners.push(
            Events.On(ProcessRun.stdoutEvent, (event: { data: { processId?: string, data?: string } }) => {
                this.accept({ processId: event.data?.processId ?? '', chunk: event.data?.data ?? '', isError: false })
            }),
            Events.On(ProcessRun.stderrEvent, (event: { data: { processId?: string, data?: string } }) => {
                this.accept({ processId: event.data?.processId ?? '', chunk: event.data?.data ?? '', isError: true })
            }),
            Events.On(ProcessRun.exitEvent, (event: { data: { processId?: string, code?: number } }) => {
                this.accept({ processId: event.data?.processId ?? '', code: event.data?.code ?? 0 })
            }),
        )
    }

    // The Go side streams while Start is still answering, so chunks buffer until the id is known.
    public attach(processId: string): void {
        this.processId = processId
        this.pending.splice(0, this.pending.length).forEach(message => this.accept(message))
    }

    public cancel(code: number): void {
        this.complete(code)
    }

    public async kill(): Promise<void> {
        if (this.finished || this.processId === '') {
            return
        }

        try {
            await ProcessService.Kill(this.processId)
        } catch {
            this.complete(ProcessRun.killedCode)
        }
    }

    protected accept(message: TProcessMessage): void {
        if (this.finished) {
            return
        }
        if (this.processId === '') {
            this.pending.push(message)
            return
        }
        if (message.processId !== this.processId) {
            return
        }

        if (message.chunk !== undefined) {
            this.emit(message.chunk, message.isError === true)
            return
        }
        if (message.code !== undefined) {
            this.complete(message.code)
        }
    }

    protected emit(chunk: string, isError: boolean): void {
        const decoder = isError ? this.errors : this.output
        const text = decoder.decode(ProcessRun.bytes(chunk), { stream: true })
        if (text !== '') {
            this.sink.onOutput(text, isError)
        }
    }

    protected complete(code: number): void {
        if (this.finished) {
            return
        }

        this.finished = true
        this.release()

        const trailingOutput = this.output.decode()
        if (trailingOutput !== '') {
            this.sink.onOutput(trailingOutput, false)
        }
        const trailingErrors = this.errors.decode()
        if (trailingErrors !== '') {
            this.sink.onOutput(trailingErrors, true)
        }

        this.sink.onExit(code)
    }

    protected release(): void {
        this.listeners.splice(0, this.listeners.length).forEach(unsubscribe => unsubscribe())
    }

    protected static bytes(chunk: string): Uint8Array {
        try {
            return Uint8Array.from(atob(chunk), character => character.charCodeAt(0))
        } catch {
            return new Uint8Array()
        }
    }
}
