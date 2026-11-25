import { describe, expect, it } from 'vitest'
import { MetadataBase64Detector } from '@/domain/models/metadata/MetadataBase64Detector'

const toBase64 = (input: string): string => {
    const bytes = new TextEncoder().encode(input)
    let binary = ''
    for (const byte of bytes) {
        binary += String.fromCharCode(byte)
    }
    return btoa(binary)
}

describe('MetadataBase64Detector', () => {
    it('detects base64-encoded JSON objects and arrays', () => {
        const payload = '{"env":"production","replicas":3}'
        const encoded = toBase64(payload)

        const hint = MetadataBase64Detector.detect(encoded)

        expect(hint).toEqual({
            decoded: payload,
            isJson: true,
            parsedJson: { env: 'production', replicas: 3 },
            byteSize: payload.length,
        })
    })

    it('detects base64-encoded printable plain text with structural separators', () => {
        const text = 'server=https://api.internal:6443\nmode=strict'
        const encoded = toBase64(text)

        const hint = MetadataBase64Detector.detect(encoded)

        expect(hint).toEqual({
            decoded: text,
            isJson: false,
            byteSize: text.length,
        })
    })

    it('detects base64-encoded UTF-8 text', () => {
        const text = 'note: сервис готов к работе'
        const encoded = toBase64(text)

        const hint = MetadataBase64Detector.detect(encoded)

        expect(hint).not.toBeNull()
        expect(hint?.decoded).toBe(text)
        expect(hint?.isJson).toBe(false)
        expect(hint?.byteSize).toBe(new TextEncoder().encode(text).length)
    })

    it('rejects pure hex digests such as SHA-256 and MD5', () => {
        const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        const md5 = 'd41d8cd98f00b204e9800998ecf8427e'

        expect(MetadataBase64Detector.detect(sha256)).toBeNull()
        expect(MetadataBase64Detector.detect(md5)).toBeNull()
    })

    it('rejects short strings, non-multiples of 4, whitespace, and invalid characters', () => {
        expect(MetadataBase64Detector.detect(toBase64('short'))).toBeNull()
        expect(MetadataBase64Detector.detect('aGVsbG8gd29ybGQ')).toBeNull()
        expect(MetadataBase64Detector.detect('aGVsbG8g d29ybGQ=')).toBeNull()
        expect(MetadataBase64Detector.detect('not-valid-base64!!!!')).toBeNull()
    })

    it('rejects binary payloads and structureless alphanumeric tokens', () => {
        const binaryBytes = new Uint8Array([0, 1, 2, 3, 255, 254, 128, 129, 130, 131, 4, 5, 6, 7, 8, 9])
        let binary = ''
        for (const byte of binaryBytes) {
            binary += String.fromCharCode(byte)
        }
        expect(MetadataBase64Detector.detect(btoa(binary))).toBeNull()

        expect(MetadataBase64Detector.detect(toBase64('plainalphanumerictoken123456'))).toBeNull()
    })
})
