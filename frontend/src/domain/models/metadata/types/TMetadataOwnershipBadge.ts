import type { TMetadataReferenceTarget } from '@/domain/models/metadata/types/TMetadataReferenceTarget'

export type TMetadataOwnershipBadge = {
    provider: 'helm' | 'argocd' | 'k8s-app' | 'prometheus'
    label: string
    detail: string
    reference?: TMetadataReferenceTarget
}
