import { TerminalBuffer } from '@/application/services/terminal/models/TerminalBuffer'
import type { ITerminalSink } from '@/application/services/terminal/types/ITerminalSink'
import type { TTerminalHint, TTerminalKind, TTerminalState } from '@/domain/models/terminal'
import type { IClusterStream } from '@/infrastructure/kube/types/IClusterStream'

export abstract class TerminalSession implements IClusterStream {
    public readonly buffer = new TerminalBuffer()

    protected disposed: boolean = false

    private view: ((data: Uint8Array) => void) | null = null

    private forget: (() => void) | null = null

    private state: TTerminalState = 'starting'

    private failure: string = ''

    private hint: TTerminalHint = 'none'

    constructor(
        public readonly key: string,
        public readonly clusterId: string,
        public readonly kind: TTerminalKind,
        private readonly sink: ITerminalSink,
    ) {}

    public get currentState(): TTerminalState {
        return this.state
    }

    public hold(forget: () => void): void {
        this.forget = forget
    }

    public attachView(write: (data: Uint8Array) => void): void {
        this.view = write

        const replay = this.buffer.snapshot()
        if (replay.length > 0) {
            write(replay)
        }
    }

    public detachView(): void {
        this.view = null
    }

    public fail(failure: string, hint: TTerminalHint = 'none'): void {
        this.enter('failed', failure, hint)
    }

    // Input after the session is over would answer with one error toast per keystroke.
    protected get isWritable(): boolean {
        return !this.disposed && this.state !== 'ended' && this.state !== 'failed'
    }

    public abstract write(data: Uint8Array): Promise<void>

    public abstract resize(cols: number, rows: number): Promise<void>

    public abstract stop(): Promise<void>

    public dispose(): void {
        this.disposed = true
        this.view = null
        this.forget?.()
        this.forget = null
    }

    protected publish(data: Uint8Array): void {
        if (this.disposed || data.length === 0) {
            return
        }

        this.buffer.append(data)
        this.view?.(data)
    }

    protected enter(state: TTerminalState, failure: string = '', hint: TTerminalHint = 'none'): void {
        if (this.state === state && this.failure === failure && this.hint === hint) {
            return
        }

        this.state = state
        this.failure = failure
        this.hint = hint
        this.sink.onState(this.key, state, failure, hint)
    }
}
