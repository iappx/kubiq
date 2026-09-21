import type { KubeResourceKind } from '@/domain/models/kube'

export type TResourceManifestDraft = {
    manifest: string
    served: readonly KubeResourceKind[]
}
