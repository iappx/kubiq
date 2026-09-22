import type { KubeResourceKind } from '@/domain/models/kube'

export type TPodEnvironmentRequest = {
    clusterId: string
    object: Record<string, unknown>
    served: readonly KubeResourceKind[]
}
