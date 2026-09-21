import type { TTerminalHint, TTerminalState } from '@/domain/models/terminal'

export interface ITerminalSink {
    onState(key: string, state: TTerminalState, failure: string, hint: TTerminalHint): void
}
