import type { KubeResourceKind } from '@/domain/models/kube/KubeResourceKind'

export type TArgoCapabilities = {
    applications?: KubeResourceKind
    appProjects?: KubeResourceKind
    applicationSets?: KubeResourceKind
}
