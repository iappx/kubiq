import type { TApiResourceDocument } from '@/domain/models/kube/discovery/types/TApiResourceDocument'

/** The /api/{version} and /apis/{group}/{version} document. */
export type TApiResourceListDocument = {
    groupVersion?: string
    resources?: TApiResourceDocument[]
}
