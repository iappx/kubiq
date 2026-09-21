export interface IPtyHandler {
    onData(stream: string, data: Uint8Array): void

    onExit(code: number): void
}
