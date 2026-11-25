import type { TMetadataParseContext } from '@/domain/models/metadata/types/TMetadataParseContext'
import type { TMetadataParsedValue } from '@/domain/models/metadata/types/TMetadataParsedValue'

export interface IMetadataValueParser {
    parse(key: string, value: string, context: TMetadataParseContext): TMetadataParsedValue | null
}
