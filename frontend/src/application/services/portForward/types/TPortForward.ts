import type { TPortForwardState } from '@/application/services/portForward/types/TPortForwardState'

export type TPortForward = {
    forwardId: string
    clusterId: string
    namespace: string
    resource: string
    name: string
    label: string
    podName: string
    remotePort: number
    targetPort: number
    localPort: number
    address: string
    state: TPortForwardState
    failure: string
}
