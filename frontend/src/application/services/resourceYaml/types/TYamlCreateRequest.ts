import type { KubeResourceKind } from '@/domain/models/kube'

export type TYamlCreateRequest = {
    clusterId: string
    kind: KubeResourceKind
    namespace: string
    document: Record<string, unknown>
}
