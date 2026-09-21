import type { TKubeWatchEventType } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchEventType'

export type TKubeWatchEvent = {
    type: TKubeWatchEventType
    object?: Record<string, unknown>
    message?: string
    details?: string
}
