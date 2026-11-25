import { describe, expect, it } from 'vitest'
import { X509CertificateParser } from '@/domain/models/certificate'
import { buildCertDer, buildCertPem, derToPem } from './x509Fixture'

const now = Date.parse('2026-06-01T12:00:00.000Z')

describe('X509CertificateParser', () => {
    it('parses a leaf V3 certificate with DNS, IPv4, IPv6, URI, and Email SANs', () => {
        const pem = buildCertPem({
            version: 3,
            serial: [0x05, 0x98, 0xec, 0x01],
            signatureOid: '1.2.840.10045.4.3.2',
            issuer: [['2.5.4.6', 'US'], ['2.5.4.10', "Let's Encrypt"], ['2.5.4.3', 'R11']],
            subject: [['2.5.4.3', 'app.example.com']],
            notBefore: '2026-05-01T00:00:00.000Z',
            notAfter: '2026-08-30T00:00:00.000Z',
            sans: [
                { type: 'dns', value: 'app.example.com' },
                { type: 'dns', value: '*.app.example.com' },
                { type: 'ipv4', value: '10.0.1.25' },
                { type: 'ipv6', value: '2001:0db8:0000:0000:0000:0000:0000:0001' },
                { type: 'uri', value: 'spiffe://cluster.local/ns/default/sa/web' },
                { type: 'email', value: 'ops@example.com' },
            ],
            isCa: false,
        })

        expect(X509CertificateParser.hasPemCertificate(pem)).toBe(true)

        const chain = X509CertificateParser.parsePem(pem, now)
        expect(chain).not.toBeNull()
        expect(chain!.hasChain).toBe(false)
        expect(chain!.missingIssuerChain).toBe(true)
        expect(chain!.worstValidity).toBe('valid')
        expect(chain!.certificates).toHaveLength(1)

        expect(chain!.certificates[0]).toEqual({
            version: 'V3',
            serialNumber: '05:98:ec:01',
            signatureAlgorithm: 'ecdsa-with-SHA256',
            issuer: "C=US, O=Let's Encrypt, CN=R11",
            subject: 'CN=app.example.com',
            notBefore: '2026-05-01T00:00:00.000Z',
            notAfter: '2026-08-30T00:00:00.000Z',
            validity: 'valid',
            subjectAltNames: [
                'DNSName(app.example.com)',
                'DNSName(*.app.example.com)',
                'IPAddress(10.0.1.25)',
                'IPAddress(2001:db8::1)',
                'URI(spiffe://cluster.local/ns/default/sa/web)',
                'Email(ops@example.com)',
            ],
            isSelfSigned: false,
            isCa: false,
        })
    })

    it('parses a 3-certificate chain in order and computes worstValidity across all certs', () => {
        const leaf = buildCertPem({
            serial: [0x01],
            issuer: [['2.5.4.3', 'Intermediate CA']],
            subject: [['2.5.4.3', 'web.example.com']],
            notBefore: '2026-05-01T00:00:00.000Z',
            notAfter: '2026-06-10T00:00:00.000Z',
            isCa: false,
        })
        const intermediate = buildCertPem({
            serial: [0x02],
            issuer: [['2.5.4.3', 'Root CA']],
            subject: [['2.5.4.3', 'Intermediate CA']],
            notBefore: '2024-01-01T00:00:00.000Z',
            notAfter: '2030-01-01T00:00:00.000Z',
            isCa: true,
        })
        const root = buildCertPem({
            serial: [0x03],
            issuer: [['2.5.4.3', 'Root CA']],
            subject: [['2.5.4.3', 'Root CA']],
            notBefore: '2020-01-01T00:00:00.000Z',
            notAfter: '2055-01-01T00:00:00.000Z',
            useGeneralizedTime: true,
            isCa: true,
        })

        const chain = X509CertificateParser.parsePem(`${leaf}\n${intermediate}\n${root}`, now)

        expect(chain).not.toBeNull()
        expect(chain!.certificates).toHaveLength(3)
        expect(chain!.hasChain).toBe(true)
        expect(chain!.missingIssuerChain).toBe(false)
        expect(chain!.worstValidity).toBe('expiring')
        expect(chain!.certificates[0].validity).toBe('expiring')
        expect(chain!.certificates[1].isCa).toBe(true)
        expect(chain!.certificates[1].isSelfSigned).toBe(false)
        expect(chain!.certificates[2].isCa).toBe(true)
        expect(chain!.certificates[2].isSelfSigned).toBe(true)
        expect(chain!.certificates[2].notAfter).toBe('2055-01-15T00:00:00.000Z'.replace('15', '01'))
    })

    it('classifies expired, not-yet-valid, expiring, and self-signed V1 certificates accurately', () => {
        const expiredPem = buildCertPem({
            notBefore: '2025-01-01T00:00:00.000Z',
            notAfter: '2026-05-29T00:00:00.000Z',
        })
        expect(X509CertificateParser.parsePem(expiredPem, now)?.worstValidity).toBe('expired')

        const futurePem = buildCertPem({
            notBefore: '2026-07-01T00:00:00.000Z',
            notAfter: '2027-07-01T00:00:00.000Z',
        })
        expect(X509CertificateParser.parsePem(futurePem, now)?.worstValidity).toBe('not-yet-valid')

        const selfSignedV1 = buildCertPem({
            version: 1,
            signatureOid: '1.3.101.112',
            issuer: [['2.5.4.3', 'internal.local']],
            subject: [['2.5.4.3', 'internal.local']],
            notBefore: '2026-01-01T00:00:00.000Z',
            notAfter: '2027-01-01T00:00:00.000Z',
        })
        const parsed = X509CertificateParser.parsePem(selfSignedV1, now)!
        expect(parsed.missingIssuerChain).toBe(false)
        expect(parsed.certificates[0].version).toBe('V1')
        expect(parsed.certificates[0].signatureAlgorithm).toBe('Ed25519')
        expect(parsed.certificates[0].isSelfSigned).toBe(true)
    })

    it('ignores private key PEM blocks and returns null on malformed or truncated PEM', () => {
        const privateKeyPem = '-----BEGIN PRIVATE KEY-----\nMIIBVQIBADANBgkqhkiG9w0BAQEFAASCAT8=\n-----END PRIVATE KEY-----'
        const rsaPrivateKeyPem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----'
        const malformedPem = '-----BEGIN CERTIFICATE-----\n!!!not-valid-base64!!!\n-----END CERTIFICATE-----'
        const validDer = buildCertDer({
            notBefore: '2026-01-01T00:00:00.000Z',
            notAfter: '2027-01-01T00:00:00.000Z',
        })
        const truncatedPem = derToPem(validDer.subarray(0, 12))

        expect(X509CertificateParser.hasPemCertificate(privateKeyPem)).toBe(false)
        expect(X509CertificateParser.hasPemCertificate(rsaPrivateKeyPem)).toBe(false)
        expect(X509CertificateParser.parsePem(privateKeyPem, now)).toBeNull()
        expect(X509CertificateParser.parsePem(malformedPem, now)).toBeNull()
        expect(X509CertificateParser.parsePem(truncatedPem, now)).toBeNull()
        expect(X509CertificateParser.parsePem('', now)).toBeNull()
    })

    it('formats concise relative labels for future and past dates', () => {
        expect(X509CertificateParser.formatRelative('2026-08-29T12:00:00.000Z', now)).toBe('in 89d')
        expect(X509CertificateParser.formatRelative('2026-06-02T00:00:00.000Z', now)).toBe('in 12h')
        expect(X509CertificateParser.formatRelative('2026-05-31T19:00:00.000Z', now)).toBe('17h ago')
        expect(X509CertificateParser.formatRelative('2026-05-29T12:00:00.000Z', now)).toBe('3d ago')
        expect(X509CertificateParser.formatRelative('2026-06-01T12:15:00.000Z', now)).toBe('in 15m')
        expect(X509CertificateParser.formatRelative('not-a-date', now)).toBe('')
    })
})
