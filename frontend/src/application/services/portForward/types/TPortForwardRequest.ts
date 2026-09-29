import type { TPortForwardRemotePort, TPortForwardResource, TPortForwardRestoreMode } from '@/domain/entities/portForward'

export type TPortForwardRequest = {
    clusterId: string
    namespace: string
    resource: TPortForwardResource
    name: string
    remotePort: TPortForwardRemotePort
    localPort: number
    restoreMode?: TPortForwardRestoreMode
}
