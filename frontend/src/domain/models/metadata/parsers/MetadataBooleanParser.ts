import type { IMetadataValueParser } from '@/domain/models/metadata/interfaces/IMetadataValueParser'
import type { TMetadataParseContext } from '@/domain/models/metadata/types/TMetadataParseContext'
import type { TMetadataParsedValue } from '@/domain/models/metadata/types/TMetadataParsedValue'

export class MetadataBooleanParser implements IMetadataValueParser {
    public parse(_key: string, value: string, _context: TMetadataParseContext): TMetadataParsedValue | null {
        const lower = value.trim().toLowerCase()
        if (lower === 'true') {
            return { kind: 'boolean', value: true }
        }
        if (lower === 'false') {
            return { kind: 'boolean', value: false }
        }

        return null
    }
}
