import type { TApiGroupListDocument } from '@/domain/models/kube/discovery/types/TApiGroupListDocument'
import type { TApiResourceListDocument } from '@/domain/models/kube/discovery/types/TApiResourceListDocument'
import type { TApiVersionsDocument } from '@/domain/models/kube/discovery/types/TApiVersionsDocument'
import type { TCustomResourceDefinitionDocument } from '@/domain/models/kube/discovery/types/TCustomResourceDefinitionDocument'

export type TKubeDiscoveryInput = {
    coreVersions?: TApiVersionsDocument
    groups?: TApiGroupListDocument
    resourceLists?: TApiResourceListDocument[]
    crds?: TCustomResourceDefinitionDocument[]
}
