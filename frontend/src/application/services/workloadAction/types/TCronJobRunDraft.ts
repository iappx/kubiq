import type { KubeResourceKind } from '@/domain/models/kube'

export type TCronJobRunDraft = {
    manifest: string
    jobKind: KubeResourceKind
    namespace: string
}
