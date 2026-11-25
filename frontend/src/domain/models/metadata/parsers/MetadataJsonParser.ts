import type { IMetadataValueParser } from '@/domain/models/metadata/interfaces/IMetadataValueParser'
import { MetadataKeyAnalyzer } from '@/domain/models/metadata/MetadataKeyAnalyzer'
import type { TMetadataParseContext } from '@/domain/models/metadata/types/TMetadataParseContext'
import type { TMetadataParsedValue } from '@/domain/models/metadata/types/TMetadataParsedValue'

export class MetadataJsonParser implements IMetadataValueParser {
    public parse(_key: string, value: string, _context: TMetadataParseContext): TMetadataParsedValue | null {
        const trimmed = value.trim()
        const isObjectShape = trimmed.startsWith('{') && trimmed.endsWith('}')
        const isArrayShape = trimmed.startsWith('[') && trimmed.endsWith(']')

        if (!isObjectShape && !isArrayShape) {
            return null
        }

        let parsed: unknown
        try {
            parsed = JSON.parse(trimmed)
        } catch {
            return null
        }

        if (!parsed || typeof parsed !== 'object') {
            return null
        }

        const isArray = Array.isArray(parsed)
        const itemCount = Array.isArray(parsed)
            ? parsed.length
            : Object.keys(parsed as Record<string, unknown>).length

        return {
            kind: 'json',
            value: parsed,
            isArray,
            itemCount,
            byteSize: MetadataKeyAnalyzer.byteLength(value),
            isLastApplied: false,
        }
    }
}
