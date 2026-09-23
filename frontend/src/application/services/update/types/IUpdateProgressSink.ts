export interface IUpdateProgressSink {
    onProgress(received: number, total: number): void
}
