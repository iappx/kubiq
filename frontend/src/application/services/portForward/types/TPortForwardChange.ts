import type { TPortForwardRemotePort, TPortForwardRestoreMode } from '@/domain/entities/portForward'

export type TPortForwardChange = {
    remotePort?: TPortForwardRemotePort
    localPort?: number
    restoreMode?: TPortForwardRestoreMode
}
