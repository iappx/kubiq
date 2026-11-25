import type { IMetadataValueParser } from '@/domain/models/metadata/interfaces/IMetadataValueParser'
import type { TMetadataParseContext } from '@/domain/models/metadata/types/TMetadataParseContext'
import type { TMetadataParsedValue } from '@/domain/models/metadata/types/TMetadataParsedValue'

export class MetadataCidrListParser implements IMetadataValueParser {
    private static readonly octetPattern: RegExp = /^(?:0|[1-9]\d{0,2})$/

    private static readonly hexGroupPattern: RegExp = /^[0-9a-fA-F]{1,4}$/

    private static readonly prefixPattern: RegExp = /^(?:0|[1-9]\d{0,2})$/

    public parse(_key: string, value: string, _context: TMetadataParseContext): TMetadataParsedValue | null {
        if (!value.includes(',')) {
            return null
        }

        const items = value.split(',').map(part => part.trim())
        if (items.length < 2 || items.some(item => item.length === 0)) {
            return null
        }

        const allValid = items.every(item => this.isIpv4OrCidr(item) || this.isIpv6OrCidr(item))
        if (!allValid) {
            return null
        }

        return {
            kind: 'list',
            items,
            separator: ',',
            itemKind: 'cidr',
        }
    }

    private isIpv4OrCidr(token: string): boolean {
        const parts = token.split('/')
        if (parts.length > 2) {
            return false
        }

        if (parts.length === 2 && !this.isValidPrefix(parts[1], 32)) {
            return false
        }

        const octets = parts[0].split('.')
        if (octets.length !== 4) {
            return false
        }

        return octets.every((octet) => {
            if (!MetadataCidrListParser.octetPattern.test(octet)) {
                return false
            }

            const num = Number(octet)

            return num >= 0 && num <= 255
        })
    }

    private isIpv6OrCidr(token: string): boolean {
        const parts = token.split('/')
        if (parts.length > 2) {
            return false
        }

        if (parts.length === 2 && !this.isValidPrefix(parts[1], 128)) {
            return false
        }

        const address = parts[0]
        if (!address.includes(':') || !/^[0-9a-fA-F:]+$/.test(address)) {
            return false
        }

        const halves = address.split('::')
        if (halves.length > 2) {
            return false
        }

        if (halves.length === 2) {
            const left = halves[0] === '' ? [] : halves[0].split(':')
            const right = halves[1] === '' ? [] : halves[1].split(':')
            const groups = [...left, ...right]

            return groups.length <= 7 && groups.every(group => MetadataCidrListParser.hexGroupPattern.test(group))
        }

        const groups = address.split(':')

        return groups.length === 8 && groups.every(group => MetadataCidrListParser.hexGroupPattern.test(group))
    }

    private isValidPrefix(prefix: string, max: number): boolean {
        if (!MetadataCidrListParser.prefixPattern.test(prefix)) {
            return false
        }

        const num = Number(prefix)

        return num >= 0 && num <= max
    }
}
