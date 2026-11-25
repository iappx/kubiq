import type { IMetadataValueParser } from '@/domain/models/metadata/interfaces/IMetadataValueParser'
import { MetadataBase64Detector } from '@/domain/models/metadata/MetadataBase64Detector'
import { MetadataKeyAnalyzer } from '@/domain/models/metadata/MetadataKeyAnalyzer'
import { MetadataKeyCatalog } from '@/domain/models/metadata/MetadataKeyCatalog'
import { MetadataArgoParser } from '@/domain/models/metadata/parsers/MetadataArgoParser'
import { MetadataBooleanParser } from '@/domain/models/metadata/parsers/MetadataBooleanParser'
import { MetadataCertificateParser } from '@/domain/models/metadata/parsers/MetadataCertificateParser'
import { MetadataCidrListParser } from '@/domain/models/metadata/parsers/MetadataCidrListParser'
import { MetadataJsonParser } from '@/domain/models/metadata/parsers/MetadataJsonParser'
import { MetadataKubeSemanticParser } from '@/domain/models/metadata/parsers/MetadataKubeSemanticParser'
import { MetadataMultilineParser } from '@/domain/models/metadata/parsers/MetadataMultilineParser'
import { MetadataTimestampParser } from '@/domain/models/metadata/parsers/MetadataTimestampParser'
import { MetadataUrlParser } from '@/domain/models/metadata/parsers/MetadataUrlParser'
import type { TMetadataEntry } from '@/domain/models/metadata/types/TMetadataEntry'
import type { TMetadataParseContext } from '@/domain/models/metadata/types/TMetadataParseContext'
import type { TMetadataParsedValue } from '@/domain/models/metadata/types/TMetadataParsedValue'

export class MetadataParser {
    private static readonly longValueThreshold: number = 200

    private static readonly collapsedMultilineThreshold: number = 3

    private static readonly parsers: readonly IMetadataValueParser[] = [
        new MetadataKubeSemanticParser(),
        new MetadataArgoParser(),
        new MetadataCertificateParser(),
        new MetadataJsonParser(),
        new MetadataMultilineParser(),
        new MetadataTimestampParser(),
        new MetadataUrlParser(),
        new MetadataBooleanParser(),
        new MetadataCidrListParser(),
    ]

    public static parseEntry(key: string, value: string, context: TMetadataParseContext): TMetadataEntry {
        const keyParts = MetadataKeyAnalyzer.split(key)
        const parsed = MetadataParser.parseValue(key, value, context)
        const base64Hint = parsed.kind === 'plain' ? MetadataBase64Detector.detect(value) : null
        const collapsedByDefault = keyParts.isNoisy
            || parsed.kind === 'json'
            || (parsed.kind === 'multiline' && parsed.lineCount > MetadataParser.collapsedMultilineThreshold)
            || parsed.kind === 'certificate'
            || value.length > MetadataParser.longValueThreshold

        return {
            key,
            rawValue: value,
            keyParts,
            parsed,
            collapsedByDefault,
            description: MetadataKeyCatalog.describe(key),
            base64Hint,
        }
    }

    public static parseMap(pairs: Record<string, string>, context: TMetadataParseContext): TMetadataEntry[] {
        return Object.keys(pairs)
            .sort((left, right) => left.localeCompare(right))
            .map(key => MetadataParser.parseEntry(key, pairs[key], context))
    }

    private static parseValue(key: string, value: string, context: TMetadataParseContext): TMetadataParsedValue {
        for (const parser of MetadataParser.parsers) {
            const result = parser.parse(key, value, context)
            if (result !== null) {
                return result
            }
        }

        return {
            kind: 'plain',
            text: value,
        }
    }
}
