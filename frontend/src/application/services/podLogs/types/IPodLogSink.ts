import type { TPodLogState } from '@/domain/models/kube'

export interface IPodLogSink {
    onLines(key: string, lineCount: number, dropped: number): void

    onState(key: string, state: TPodLogState, failure: string): void
}
