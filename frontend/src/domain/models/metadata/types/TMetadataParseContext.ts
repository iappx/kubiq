import type { TMetadataKind } from '@/domain/models/metadata/types/TMetadataKind'

export type TMetadataParseContext = {
    kind: TMetadataKind
    namespace: string
    objectKind: string
    allLabels: Record<string, string>
    allAnnotations: Record<string, string>
}
