export interface IDownloadSink {
    onProgress(received: number, total: number): void
}
