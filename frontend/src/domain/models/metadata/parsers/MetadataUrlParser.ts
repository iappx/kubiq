import type { IMetadataValueParser } from '@/domain/models/metadata/interfaces/IMetadataValueParser'
import type { TMetadataParseContext } from '@/domain/models/metadata/types/TMetadataParseContext'
import type { TMetadataParsedValue } from '@/domain/models/metadata/types/TMetadataParsedValue'

export class MetadataUrlParser implements IMetadataValueParser {
    private static readonly allowedPrefixes: readonly string[] = [
        'https://',
        'http://',
        'oci://',
        'ssh://',
        'git://',
        's3://',
        'gs://',
    ]

    private static readonly allowedProtocols: ReadonlySet<string> = new Set([
        'https:',
        'http:',
        'oci:',
        'ssh:',
        'git:',
        's3:',
        'gs:',
    ])

    public parse(_key: string, value: string, _context: TMetadataParseContext): TMetadataParsedValue | null {
        const trimmed = value.trim()
        if (!trimmed || /\s/.test(trimmed)) {
            return null
        }

        const lower = trimmed.toLowerCase()
        const hasAllowedPrefix = MetadataUrlParser.allowedPrefixes.some(prefix => lower.startsWith(prefix))
        if (!hasAllowedPrefix) {
            return null
        }

        let url: URL
        try {
            url = new URL(trimmed)
        } catch {
            return null
        }

        const protocol = url.protocol.toLowerCase()
        if (!MetadataUrlParser.allowedProtocols.has(protocol) || url.hostname.length === 0) {
            return null
        }

        return {
            kind: 'url',
            href: trimmed,
            protocol,
            clickable: protocol === 'http:' || protocol === 'https:',
        }
    }
}
