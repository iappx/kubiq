import { Events } from '@wailsio/runtime'
import { TerminalBytes } from '@/domain/models/terminal'
import type { IPtyHandler } from '@/infrastructure/process/types/IPtyHandler'

type TPtyMessage = {
    processId: string
    stream?: string
    data?: string
    code?: number
}

export class PtySubscription {
    public static readonly stdoutEvent: string = 'process:stdout'

    public static readonly stderrEvent: string = 'process:stderr'

    public static readonly exitEvent: string = 'process:exit'

    private readonly listeners: (() => void)[] = []

    private readonly pending: TPtyMessage[] = []

    private process: string = ''

    private closed: boolean = false

    constructor(private readonly handler: IPtyHandler) {}

    public get id(): string {
        return this.process
    }

    public listen(): void {
        this.listeners.push(
            Events.On(PtySubscription.stdoutEvent, (event: { data: { processId?: string, data?: string } }) => {
                this.accept({ processId: event.data?.processId ?? '', stream: 'stdout', data: event.data?.data ?? '' })
            }),
            Events.On(PtySubscription.stderrEvent, (event: { data: { processId?: string, data?: string } }) => {
                this.accept({ processId: event.data?.processId ?? '', stream: 'stderr', data: event.data?.data ?? '' })
            }),
            Events.On(PtySubscription.exitEvent, (event: { data: { processId?: string, code?: number } }) => {
                this.accept({ processId: event.data?.processId ?? '', code: event.data?.code ?? 0 })
            }),
        )
    }

    // A shell writes its prompt before Start's answer crosses the bridge, so output
    // arriving while the id is still unknown is held rather than dropped.
    public attach(processId: string): void {
        this.process = processId
        const buffered = this.pending.splice(0, this.pending.length)
        buffered.forEach(message => this.accept(message))
    }

    public cancel(): void {
        this.closed = true
        this.release()
    }

    public release(): void {
        this.listeners.splice(0, this.listeners.length).forEach(unsubscribe => unsubscribe())
    }

    protected accept(message: TPtyMessage): void {
        if (this.closed) {
            return
        }
        if (this.process === '') {
            this.pending.push(message)
            return
        }
        if (message.processId !== this.process) {
            return
        }

        if (message.data !== undefined) {
            this.handler.onData(message.stream ?? 'stdout', TerminalBytes.decode(message.data))
            return
        }
        if (message.code !== undefined) {
            this.closed = true
            this.release()
            this.handler.onExit(message.code)
        }
    }
}
