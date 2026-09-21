export type TPortForwardRequest = {
    clusterId: string
    namespace: string
    resource: string
    name: string
    remotePort: number
    localPort: number
}
