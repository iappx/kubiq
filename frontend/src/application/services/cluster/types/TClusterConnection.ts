export type TClusterConnection = {
    clusterId: string
    contextName: string
    server: string
    sessionId: string
    version: string
    canOpenChannel: boolean
    channelBlockReason: string
    connectedAt: number
}
