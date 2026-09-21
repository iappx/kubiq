import type { KubeResourceKind } from '@/domain/models/kube'

export type TYamlApplyRequest = {
    clusterId: string
    kind: KubeResourceKind
    name: string
    namespace: string
    current: Record<string, unknown>
    edited: Record<string, unknown>
}
