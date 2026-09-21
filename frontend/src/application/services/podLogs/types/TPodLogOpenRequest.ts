import type { TPodLogOptions } from '@/domain/models/kube'

export type TPodLogOpenRequest = {
    key: string
    clusterId: string
    namespace: string
    podName: string
    options: TPodLogOptions
}
