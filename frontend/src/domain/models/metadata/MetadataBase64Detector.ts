import type { TMetadataBase64Hint } from '@/domain/models/metadata/types/TMetadataBase64Hint'

export class MetadataBase64Detector {
    private static readonly minLength: number = 16

    private static readonly minPrintableRatio: number = 0.95

    private static readonly whitespacePattern: RegExp = /\s/

    private static readonly base64Pattern: RegExp = /^[A-Za-z0-9+/]+={0,2}$/

    private static readonly pureHexPattern: RegExp = /^[0-9a-fA-F]+$/

    private static readonly unicodePrintablePattern: RegExp = /[\p{L}\p{N}\p{P}\p{S}\p{Zs}]/u

    private static readonly structureHintPattern: RegExp = /[ \n=:/]/

    private static readonly decoder: TextDecoder = new TextDecoder('utf-8', { fatal: true })

    public static detect(value: string): TMetadataBase64Hint | null {
        if (value.length < MetadataBase64Detector.minLength || value.length % 4 !== 0) {
            return null
        }
        if (MetadataBase64Detector.whitespacePattern.test(value)) {
            return null
        }
        if (!MetadataBase64Detector.base64Pattern.test(value)) {
            return null
        }
        if (MetadataBase64Detector.pureHexPattern.test(value)) {
            return null
        }

        const bytes = MetadataBase64Detector.decodeBytes(value)
        if (!bytes || bytes.length === 0) {
            return null
        }

        const decoded = MetadataBase64Detector.decodeUtf8(bytes)
        if (decoded === null || decoded.length === 0) {
            return null
        }

        if (!MetadataBase64Detector.isMostlyPrintable(decoded)) {
            return null
        }

        const parsedJson = MetadataBase64Detector.tryParseJsonContainer(decoded)
        if (parsedJson !== undefined) {
            return {
                decoded,
                isJson: true,
                parsedJson,
                byteSize: bytes.length,
            }
        }

        if (!MetadataBase64Detector.structureHintPattern.test(decoded)) {
            return null
        }

        return {
            decoded,
            isJson: false,
            byteSize: bytes.length,
        }
    }

    private static decodeBytes(value: string): Uint8Array | null {
        try {
            const binary = atob(value)
            const bytes = new Uint8Array(binary.length)
            for (let index = 0; index < binary.length; index++) {
                bytes[index] = binary.charCodeAt(index)
            }
            return bytes
        } catch {
            return null
        }
    }

    private static decodeUtf8(bytes: Uint8Array): string | null {
        try {
            return MetadataBase64Detector.decoder.decode(bytes)
        } catch {
            return null
        }
    }

    private static isMostlyPrintable(text: string): boolean {
        let total = 0
        let printable = 0

        for (const ch of text) {
            total += 1
            if (MetadataBase64Detector.isPrintableChar(ch)) {
                printable += 1
            }
        }

        if (total === 0) {
            return false
        }

        return printable / total >= MetadataBase64Detector.minPrintableRatio
    }

    private static isPrintableChar(ch: string): boolean {
        const code = ch.codePointAt(0)
        if (code === undefined) {
            return false
        }
        if (code === 0x09 || code === 0x0A || code === 0x0D) {
            return true
        }
        if (code >= 0x20 && code <= 0x7E) {
            return true
        }
        if (code < 0x20 || (code >= 0x7F && code <= 0x9F) || code === 0xFFFD) {
            return false
        }
        return MetadataBase64Detector.unicodePrintablePattern.test(ch)
    }

    private static tryParseJsonContainer(text: string): unknown | undefined {
        const trimmed = text.trim()
        const isObject = trimmed.startsWith('{') && trimmed.endsWith('}')
        const isArray = trimmed.startsWith('[') && trimmed.endsWith(']')
        if (!isObject && !isArray) {
            return undefined
        }

        try {
            const parsed: unknown = JSON.parse(trimmed)
            if (typeof parsed === 'object' && parsed !== null) {
                return parsed
            }
            return undefined
        } catch {
            return undefined
        }
    }
}
