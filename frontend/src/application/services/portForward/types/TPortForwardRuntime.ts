import type { TPortForwardStatus } from '@/domain/entities/portForward'

export type TPortForwardRuntime = {
    status: TPortForwardStatus
    error: string
    boundPort: number
    podName: string
    targetPort: number
}
