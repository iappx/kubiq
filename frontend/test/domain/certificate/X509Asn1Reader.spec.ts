import { describe, expect, it } from 'vitest'
import { X509Asn1Reader } from '@/domain/models/certificate'

describe('X509Asn1Reader', () => {
    it('reads short and long form lengths safely without throwing on truncated buffers', () => {
        const shortSeq = new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x05])
        const node = X509Asn1Reader.readNode(shortSeq, 0)

        expect(node).not.toBeNull()
        expect(node!.contentStart).toBe(2)
        expect(node!.contentLength).toBe(3)
        expect(node!.end).toBe(5)

        const longContent = new Uint8Array(130)
        longContent[0] = 0x04
        longContent[1] = 0x81
        longContent[2] = 127
        const longNode = X509Asn1Reader.readNode(longContent, 0)

        expect(longNode).not.toBeNull()
        expect(longNode!.contentStart).toBe(3)
        expect(longNode!.contentLength).toBe(127)

        expect(X509Asn1Reader.readNode(new Uint8Array([0x30, 0x10, 0x01]), 0)).toBeNull()
        expect(X509Asn1Reader.readNode(new Uint8Array([0x30, 0x80, 0x00, 0x00]), 0)).toBeNull()
        expect(X509Asn1Reader.readNode(new Uint8Array([]), 0)).toBeNull()
    })

    it('decodes OIDs, integers, booleans, strings, and ASN.1 timestamps', () => {
        const oidBytes = new Uint8Array([0x06, 0x03, 0x55, 0x04, 0x03])
        const oidNode = X509Asn1Reader.readNode(oidBytes, 0)!
        expect(X509Asn1Reader.readOid(oidBytes, oidNode)).toBe('2.5.4.3')

        const intBytes = new Uint8Array([0x02, 0x04, 0x00, 0xab, 0x05, 0x1f])
        const intNode = X509Asn1Reader.readNode(intBytes, 0)!
        expect(X509Asn1Reader.readIntegerHex(intBytes, intNode)).toBe('ab:05:1f')

        const boolBytes = new Uint8Array([0x01, 0x01, 0xff])
        const boolNode = X509Asn1Reader.readNode(boolBytes, 0)!
        expect(X509Asn1Reader.readBoolean(boolBytes, boolNode)).toBe(true)

        const utf8Payload = new TextEncoder().encode('café')
        const utf8Bytes = new Uint8Array([0x0c, utf8Payload.length, ...utf8Payload])
        const utf8Node = X509Asn1Reader.readNode(utf8Bytes, 0)!
        expect(X509Asn1Reader.readString(utf8Bytes, utf8Node)).toBe('café')

        const bmpBytes = new Uint8Array([0x1e, 0x04, 0x00, 0x4f, 0x00, 0x4b])
        const bmpNode = X509Asn1Reader.readNode(bmpBytes, 0)!
        expect(X509Asn1Reader.readString(bmpBytes, bmpNode)).toBe('OK')

        const utcRaw = Array.from('260726072011Z', ch => ch.charCodeAt(0))
        const utcBytes = new Uint8Array([0x17, utcRaw.length, ...utcRaw])
        const utcNode = X509Asn1Reader.readNode(utcBytes, 0)!
        expect(X509Asn1Reader.readTime(utcBytes, utcNode)).toBe('2026-07-26T07:20:11.000Z')

        const genRaw = Array.from('20510115123045Z', ch => ch.charCodeAt(0))
        const genBytes = new Uint8Array([0x18, genRaw.length, ...genRaw])
        const genNode = X509Asn1Reader.readNode(genBytes, 0)!
        expect(X509Asn1Reader.readTime(genBytes, genNode)).toBe('2051-01-15T12:30:45.000Z')
    })
})
