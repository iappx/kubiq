export type TKubeForwardSpec = {
    sessionId: string
    path: string
    remotePort: number
    localPort?: number
    localAddress?: string
    subprotocols?: string[]
}
