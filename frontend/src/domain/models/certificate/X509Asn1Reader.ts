import type { TAsn1Node } from '@/domain/models/certificate/types/TAsn1Node'

export class X509Asn1Reader {
    public static readonly tagBoolean: number = 0x01

    public static readonly tagInteger: number = 0x02

    public static readonly tagBitString: number = 0x03

    public static readonly tagOctetString: number = 0x04

    public static readonly tagOid: number = 0x06

    public static readonly tagUtf8String: number = 0x0c

    public static readonly tagPrintableString: number = 0x13

    public static readonly tagTeletexString: number = 0x14

    public static readonly tagIa5String: number = 0x16

    public static readonly tagUtcTime: number = 0x17

    public static readonly tagGeneralizedTime: number = 0x18

    public static readonly tagVisibleString: number = 0x1a

    public static readonly tagUniversalString: number = 0x1c

    public static readonly tagBmpString: number = 0x1e

    public static readonly tagSequence: number = 0x30

    public static readonly tagSet: number = 0x31

    public static readonly classContextSpecific: number = 2

    private static readonly utf8Decoder: TextDecoder = new TextDecoder('utf-8')

    private static readonly utcTimePattern: RegExp = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(Z|[+-]\d{4})$/

    private static readonly generalizedTimePattern: RegExp = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\.(\d+))?(Z|[+-]\d{4})$/

    public static readNode(bytes: Uint8Array, offset: number, limit: number = bytes.length): TAsn1Node | null {
        if (offset < 0 || limit > bytes.length || offset >= limit) {
            return null
        }

        const tag = bytes[offset]
        const tagClass = (tag >> 6) & 0x03
        const constructed = (tag & 0x20) !== 0
        let tagNumber = tag & 0x1f
        let pos = offset + 1

        if (tagNumber === 0x1f) {
            tagNumber = 0
            let read = 0
            let byte: number
            do {
                if (pos >= limit || read >= 4) {
                    return null
                }
                byte = bytes[pos++]
                tagNumber = tagNumber * 128 + (byte & 0x7f)
                read++
            } while ((byte & 0x80) !== 0)
        }

        if (pos >= limit) {
            return null
        }

        const firstLen = bytes[pos++]
        let contentLength = 0

        if ((firstLen & 0x80) === 0) {
            contentLength = firstLen
        } else {
            const octets = firstLen & 0x7f
            if (octets === 0 || octets > 4 || pos + octets > limit) {
                return null
            }

            for (let i = 0; i < octets; i++) {
                contentLength = contentLength * 256 + bytes[pos++]
            }
        }

        const end = pos + contentLength
        if (end > limit) {
            return null
        }

        return {
            tag,
            tagClass,
            constructed,
            tagNumber,
            headerStart: offset,
            contentStart: pos,
            contentLength,
            end,
        }
    }

    public static readChildren(bytes: Uint8Array, node: TAsn1Node): TAsn1Node[] | null {
        if (!node.constructed) {
            return null
        }

        const children: TAsn1Node[] = []
        let pos = node.contentStart

        while (pos < node.end) {
            const child = X509Asn1Reader.readNode(bytes, pos, node.end)
            if (!child || child.end <= pos) {
                return null
            }

            children.push(child)
            pos = child.end
        }

        return pos === node.end ? children : null
    }

    public static readOid(bytes: Uint8Array, node: TAsn1Node): string | null {
        if (node.tag !== X509Asn1Reader.tagOid || node.contentLength < 1) {
            return null
        }

        const firstByte = bytes[node.contentStart]
        const first = firstByte < 40 ? 0 : firstByte < 80 ? 1 : 2
        const second = firstByte - first * 40
        const arcs: number[] = [first, second]

        let pos = node.contentStart + 1
        while (pos < node.end) {
            let value = 0
            let read = 0
            let byte: number

            do {
                if (pos >= node.end || read >= 7) {
                    return null
                }
                byte = bytes[pos++]
                value = value * 128 + (byte & 0x7f)
                read++
            } while ((byte & 0x80) !== 0)

            arcs.push(value)
        }

        return arcs.join('.')
    }

    public static readIntegerHex(bytes: Uint8Array, node: TAsn1Node): string | null {
        if (node.tag !== X509Asn1Reader.tagInteger || node.contentLength < 1) {
            return null
        }

        let start = node.contentStart
        if (node.end - start > 1 && bytes[start] === 0) {
            start++
        }

        const parts: string[] = []
        for (let i = start; i < node.end; i++) {
            parts.push(bytes[i].toString(16).padStart(2, '0'))
        }

        return parts.join(':')
    }

    public static readSmallInteger(bytes: Uint8Array, node: TAsn1Node): number | null {
        if (node.tag !== X509Asn1Reader.tagInteger || node.contentLength < 1 || node.contentLength > 4) {
            return null
        }

        if ((bytes[node.contentStart] & 0x80) !== 0) {
            return null
        }

        let value = 0
        for (let i = node.contentStart; i < node.end; i++) {
            value = value * 256 + bytes[i]
        }

        return value
    }

    public static readBoolean(bytes: Uint8Array, node: TAsn1Node): boolean | null {
        if (node.tag !== X509Asn1Reader.tagBoolean || node.contentLength !== 1) {
            return null
        }

        return bytes[node.contentStart] !== 0
    }

    public static readString(bytes: Uint8Array, node: TAsn1Node): string | null {
        const slice = bytes.subarray(node.contentStart, node.end)

        switch (node.tag) {
            case X509Asn1Reader.tagUtf8String:
                return X509Asn1Reader.utf8Decoder.decode(slice)
            case X509Asn1Reader.tagPrintableString:
            case X509Asn1Reader.tagTeletexString:
            case X509Asn1Reader.tagIa5String:
            case X509Asn1Reader.tagVisibleString:
                return X509Asn1Reader.readLatin1(slice)
            case X509Asn1Reader.tagBmpString:
                return X509Asn1Reader.readBmpString(slice)
            case X509Asn1Reader.tagUniversalString:
                return X509Asn1Reader.readUniversalString(slice)
            default:
                return null
        }
    }

    public static readRawAscii(bytes: Uint8Array, node: TAsn1Node): string {
        return X509Asn1Reader.readLatin1(bytes.subarray(node.contentStart, node.end))
    }

    public static readTime(bytes: Uint8Array, node: TAsn1Node): string | null {
        const raw = X509Asn1Reader.readRawAscii(bytes, node)

        if (node.tag === X509Asn1Reader.tagUtcTime) {
            return X509Asn1Reader.parseUtcTime(raw)
        }
        if (node.tag === X509Asn1Reader.tagGeneralizedTime) {
            return X509Asn1Reader.parseGeneralizedTime(raw)
        }

        return null
    }

    public static sliceContent(bytes: Uint8Array, node: TAsn1Node): Uint8Array {
        return bytes.subarray(node.contentStart, node.end)
    }

    private static readLatin1(slice: Uint8Array): string {
        let out = ''
        for (let i = 0; i < slice.length; i++) {
            out += String.fromCharCode(slice[i])
        }

        return out
    }

    private static readBmpString(slice: Uint8Array): string | null {
        if (slice.length % 2 !== 0) {
            return null
        }

        let out = ''
        for (let i = 0; i < slice.length; i += 2) {
            out += String.fromCharCode((slice[i] << 8) | slice[i + 1])
        }

        return out
    }

    private static readUniversalString(slice: Uint8Array): string | null {
        if (slice.length % 4 !== 0) {
            return null
        }

        let out = ''
        for (let i = 0; i < slice.length; i += 4) {
            const codePoint = ((slice[i] << 24) >>> 0) | (slice[i + 1] << 16) | (slice[i + 2] << 8) | slice[i + 3]
            if (codePoint > 0x10ffff) {
                return null
            }
            out += String.fromCodePoint(codePoint)
        }

        return out
    }

    private static parseUtcTime(raw: string): string | null {
        const match = X509Asn1Reader.utcTimePattern.exec(raw)
        if (!match) {
            return null
        }

        const yy = Number(match[1])
        const year = yy >= 50 ? 1900 + yy : 2000 + yy

        return X509Asn1Reader.toIsoUtc(
            year,
            Number(match[2]),
            Number(match[3]),
            Number(match[4]),
            Number(match[5]),
            match[6] ? Number(match[6]) : 0,
            0,
            match[7],
        )
    }

    private static parseGeneralizedTime(raw: string): string | null {
        const match = X509Asn1Reader.generalizedTimePattern.exec(raw)
        if (!match) {
            return null
        }

        const ms = match[7] ? Number(match[7].slice(0, 3).padEnd(3, '0')) : 0

        return X509Asn1Reader.toIsoUtc(
            Number(match[1]),
            Number(match[2]),
            Number(match[3]),
            Number(match[4]),
            Number(match[5]),
            match[6] ? Number(match[6]) : 0,
            ms,
            match[8],
        )
    }

    private static toIsoUtc(
        year: number,
        month: number,
        day: number,
        hour: number,
        minute: number,
        second: number,
        ms: number,
        tz: string,
    ): string | null {
        if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
            return null
        }

        let offsetMs = 0
        if (tz !== 'Z') {
            const sign = tz[0] === '+' ? 1 : -1
            const tzHours = Number(tz.slice(1, 3))
            const tzMinutes = Number(tz.slice(3, 5))
            if (tzHours > 23 || tzMinutes > 59) {
                return null
            }
            offsetMs = sign * (tzHours * 60 + tzMinutes) * 60_000
        }

        const utcMs = Date.UTC(year, month - 1, day, hour, minute, second, ms) - offsetMs
        if (!Number.isFinite(utcMs)) {
            return null
        }

        return new Date(utcMs).toISOString()
    }
}
