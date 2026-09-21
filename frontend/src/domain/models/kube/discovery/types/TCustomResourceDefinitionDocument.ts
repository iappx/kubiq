import type { TCrdNamesDocument } from '@/domain/models/kube/discovery/types/TCrdNamesDocument'
import type { TCrdVersionDocument } from '@/domain/models/kube/discovery/types/TCrdVersionDocument'

export type TCustomResourceDefinitionDocument = {
    spec?: {
        group?: string
        scope?: string
        names?: TCrdNamesDocument
        versions?: TCrdVersionDocument[]
    }
}
