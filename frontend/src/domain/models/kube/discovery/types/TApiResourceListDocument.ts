import type { TApiResourceDocument } from '@/domain/models/kube/discovery/types/TApiResourceDocument'

export type TApiResourceListDocument = {
    groupVersion?: string
    resources?: TApiResourceDocument[]
}
