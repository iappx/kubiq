import type { TApiGroupDocument } from '@/domain/models/kube/discovery/types/TApiGroupDocument'

/** The /apis document. */
export type TApiGroupListDocument = {
    groups?: TApiGroupDocument[]
}
