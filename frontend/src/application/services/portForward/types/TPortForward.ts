import type {
    TPortForwardRemotePort,
    TPortForwardResource,
    TPortForwardRestoreMode,
    TPortForwardStatus,
} from '@/domain/entities/portForward'

export type TPortForward = {
    id: string
    clusterId: string
    namespace: string
    resource: TPortForwardResource
    name: string
    remotePort: TPortForwardRemotePort
    localPort: number
    lastLocalPort: number
    restoreMode: TPortForwardRestoreMode
    isStoppedByUser: boolean
    createdAt: number
    label: string
    status: TPortForwardStatus
    error: string
    boundPort: number
    podName: string
    targetPort: number
}
