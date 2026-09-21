export interface IHelmOperationSink {
    onOperationOutput(key: string, lineCount: number): void

    onOperationFinished(key: string, code: number): void
}
