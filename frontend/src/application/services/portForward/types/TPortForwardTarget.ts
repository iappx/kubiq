export type TPortForwardTarget = {
    clusterId: string
    namespace: string
    resource: string
    name: string
    remotePort: number
}
