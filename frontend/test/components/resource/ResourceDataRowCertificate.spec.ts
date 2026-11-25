import { describe, expect, it } from 'vitest'
import { ResourceRowBuilder } from '@/components/resource/ResourceRowBuilder'
import { DetailDataEntries } from '@/components/resource/detail/DetailDataEntries'
import { SecretEntity } from '@/domain/entities/config'
import { X509CertificateParser } from '@/domain/models/certificate'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { buildCertPem, textToBase64 } from '../../domain/certificate/x509Fixture'

const futureIso = (days: number): string => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

describe('TLS Secret row building and certificate bundle detection', () => {
    const leafPem = buildCertPem({
        serial: [0x05, 0x98, 0xec],
        issuer: [['2.5.4.10', 'Test CA'], ['2.5.4.3', 'Test Intermediate']],
        subject: [['2.5.4.3', 'ingress.example.com']],
        notBefore: futureIso(-10),
        notAfter: futureIso(89),
        sans: [{ type: 'dns', value: 'ingress.example.com' }],
    })
    const expiringPem = buildCertPem({
        notBefore: futureIso(-30),
        notAfter: futureIso(5),
    })
    const expiredPem = buildCertPem({
        notBefore: futureIso(-120),
        notAfter: futureIso(-2),
    })
    const fakeKeyText = '-----BEGIN PRIVATE KEY-----\nSYNTHETIC-NON-SECRET-TEST-KEY\n-----END PRIVATE KEY-----'
    const tlsSecret = {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name: 'ingress-tls', namespace: 'default' },
        type: 'kubernetes.io/tls',
        data: {
            'tls.crt': textToBase64(leafPem),
            'tls.key': textToBase64(fakeKeyText),
            'combined.pem': textToBase64(`${leafPem}\n${fakeKeyText}`),
        },
    }

    it('parses tls.crt as a public certificate bundle while rejecting tls.key and combined key+cert PEMs', () => {
        const secretsKind = KubeResourceRegistry.find('', 'secrets')!
        const entries = DetailDataEntries.of(tlsSecret, secretsKind)
        const byKey = (key: string) => DetailDataEntries.valueOf(tlsSecret, entries.find(item => item.key === key)!)

        const certChain = X509CertificateParser.parsePublicPem(byKey('tls.crt'))
        expect(certChain).not.toBeNull()
        expect(certChain!.certificates[0].serialNumber).toBe('05:98:ec')
        expect(certChain!.certificates[0].subjectAltNames).toEqual(['DNSName(ingress.example.com)'])
        expect(certChain!.missingIssuerChain).toBe(true)

        expect(X509CertificateParser.parsePublicPem(byKey('tls.key'))).toBeNull()
        expect(X509CertificateParser.parsePublicPem(byKey('combined.pem'))).toBeNull()
    })

    it('maps TLS Secrets with valid, expiring, expired, and missing certs onto ResourceRowBuilder states', () => {
        const buildRow = (data?: Record<string, string>) => {
            const entity = SecretEntity.build({
                uid: 'tls-row',
                metadata: { uid: 'tls-row', name: 'ingress-tls', namespace: 'default' },
                type: 'kubernetes.io/tls',
                data,
            })

            return ResourceRowBuilder.build([entity], [{ key: 'name', title: 'Name' }])[0]
        }

        const validRow = buildRow({ 'tls.crt': textToBase64(leafPem) })
        expect(validRow.hasState).toBe(true)
        expect(validRow.tone).toBe('ok')
        expect(validRow.statusTitle).toBe('Valid')

        const expiringRow = buildRow({ 'tls.crt': textToBase64(expiringPem) })
        expect(expiringRow.hasState).toBe(true)
        expect(expiringRow.tone).toBe('warning')
        expect(expiringRow.statusTitle).toBe('Expiring soon')

        const expiredRow = buildRow({ 'tls.crt': textToBase64(expiredPem) })
        expect(expiredRow.hasState).toBe(true)
        expect(expiredRow.tone).toBe('error')
        expect(expiredRow.statusTitle).toBe('Expired')

        const emptyRow = buildRow(undefined)
        expect(emptyRow.hasState).toBe(false)
    })
})
