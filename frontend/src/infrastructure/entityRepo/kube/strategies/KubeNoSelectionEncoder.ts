import { EncodedQueryMerger } from '@iappx/entity-repo-rest'
import type { ISelectionEncoder, TCapabilitySlice, TEncodedQuery } from '@iappx/entity-repo-rest'

// Without it the dialect installs FieldsSelectionEncoder, which declares flat
// selection and would let select() compile into a ?fields= the API server has no
// notion of.
export class KubeNoSelectionEncoder implements ISelectionEncoder {
    public readonly capabilities: TCapabilitySlice = { selection: 'none' }

    public encode(): TEncodedQuery {
        return EncodedQueryMerger.empty()
    }
}
