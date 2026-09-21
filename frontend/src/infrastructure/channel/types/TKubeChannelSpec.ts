export type TKubeChannelSpec = {
    sessionId: string
    path: string
    subprotocols?: string[]
    tty?: boolean
    cols?: number
    rows?: number
}
