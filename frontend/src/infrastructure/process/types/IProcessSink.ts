export interface IProcessSink {
    onOutput(text: string, isError: boolean): void

    onExit(code: number): void
}
