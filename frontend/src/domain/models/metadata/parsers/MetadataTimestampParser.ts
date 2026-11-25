import type { IMetadataValueParser } from '@/domain/models/metadata/interfaces/IMetadataValueParser'
import type { TMetadataParseContext } from '@/domain/models/metadata/types/TMetadataParseContext'
import type { TMetadataParsedValue } from '@/domain/models/metadata/types/TMetadataParsedValue'

export class MetadataTimestampParser implements IMetadataValueParser {
    private static readonly rfc3339Pattern: RegExp = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

    public parse(_key: string, value: string, _context: TMetadataParseContext): TMetadataParsedValue | null {
        const trimmed = value.trim()
        const match = MetadataTimestampParser.rfc3339Pattern.exec(trimmed)
        if (!match) {
            return null
        }

        const year = Number(match[1])
        const month = Number(match[2])
        const day = Number(match[3])
        const hour = Number(match[4])
        const minute = Number(match[5])
        const second = Number(match[6])

        if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
            return null
        }

        const calendarCheck = new Date(Date.UTC(year, month - 1, day))
        if (
            calendarCheck.getUTCFullYear() !== year
            || calendarCheck.getUTCMonth() !== month - 1
            || calendarCheck.getUTCDate() !== day
        ) {
            return null
        }

        const epochMs = Date.parse(trimmed)
        if (Number.isNaN(epochMs)) {
            return null
        }

        return {
            kind: 'timestamp',
            iso: trimmed,
            epochMs,
        }
    }
}
