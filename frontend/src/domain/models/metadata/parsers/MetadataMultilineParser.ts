import type { IMetadataValueParser } from '@/domain/models/metadata/interfaces/IMetadataValueParser'
import { MetadataKeyAnalyzer } from '@/domain/models/metadata/MetadataKeyAnalyzer'
import type { TMetadataParseContext } from '@/domain/models/metadata/types/TMetadataParseContext'
import type { TMetadataParsedValue } from '@/domain/models/metadata/types/TMetadataParsedValue'

export class MetadataMultilineParser implements IMetadataValueParser {
    private static readonly nginxDirectivePattern: RegExp = /^\s*(?:location|proxy_set_header|proxy_pass|add_header|more_set_headers|set|rewrite|if|return|server|upstream|limit_req|error_page|allow|deny|client_max_body_size)\b/

    private static readonly iniSectionPattern: RegExp = /^\s*\[[^\]\r\n]+\]\s*$/

    private static readonly iniEntryPattern: RegExp = /^\s*[a-zA-Z0-9_.-]+\s*=\s*.*$/

    private static readonly yamlLinePattern: RegExp = /^\s*(?:-\s+\S|[a-zA-Z0-9_.-]+:\s*(?:\S.*)?$)/

    public parse(key: string, value: string, _context: TMetadataParseContext): TMetadataParsedValue | null {
        if (!value.includes('\n')) {
            return null
        }

        const normalized = value.replace(/\r\n/g, '\n')
        const rawLines = normalized.split('\n')
        const lineCount = normalized.endsWith('\n')
            ? Math.max(1, rawLines.length - 1)
            : rawLines.length

        return {
            kind: 'multiline',
            text: value,
            lineCount,
            byteSize: MetadataKeyAnalyzer.byteLength(value),
            syntaxHint: this.detectSyntax(key, rawLines),
        }
    }

    private detectSyntax(key: string, lines: readonly string[]): 'yaml' | 'nginx' | 'ini' | 'text' {
        const lowerKey = key.toLowerCase()
        const activeLines = lines
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'))

        if (this.isNginx(lowerKey, activeLines)) {
            return 'nginx'
        }

        if (this.isIni(activeLines)) {
            return 'ini'
        }

        if (this.isYaml(lowerKey, activeLines)) {
            return 'yaml'
        }

        return 'text'
    }

    private isNginx(lowerKey: string, lines: readonly string[]): boolean {
        if (lowerKey.includes('snippet')) {
            return true
        }

        const hasDirective = lines.some(line => MetadataMultilineParser.nginxDirectivePattern.test(line))
        if (hasDirective) {
            return true
        }

        const semicolonLines = lines.filter(line => line.endsWith(';')).length

        return semicolonLines >= 2
    }

    private isIni(lines: readonly string[]): boolean {
        const hasSection = lines.some(line => MetadataMultilineParser.iniSectionPattern.test(line))
        const hasEntry = lines.some(line => MetadataMultilineParser.iniEntryPattern.test(line))

        return hasSection && hasEntry
    }

    private isYaml(lowerKey: string, lines: readonly string[]): boolean {
        if (lowerKey.endsWith('.yaml') || lowerKey.endsWith('.yml')) {
            return true
        }

        if (lines.some(line => line === '---')) {
            return true
        }

        const yamlLikeCount = lines.filter(line => MetadataMultilineParser.yamlLinePattern.test(line)).length

        return yamlLikeCount >= 2 && yamlLikeCount * 2 >= lines.length
    }
}
