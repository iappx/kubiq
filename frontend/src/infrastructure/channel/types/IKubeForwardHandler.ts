export interface IKubeForwardHandler {
    onError(details: string): void

    onClose(status: string): void
}
