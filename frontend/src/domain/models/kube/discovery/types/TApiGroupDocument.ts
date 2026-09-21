import type { TGroupVersionDocument } from '@/domain/models/kube/discovery/types/TGroupVersionDocument'

export type TApiGroupDocument = {
    name?: string
    versions?: TGroupVersionDocument[]
    preferredVersion?: TGroupVersionDocument
}
