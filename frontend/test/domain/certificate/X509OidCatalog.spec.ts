import { describe, expect, it } from 'vitest'
import { X509OidCatalog } from '@/domain/models/certificate'

describe('X509OidCatalog', () => {
    it('maps common X.509 attribute OIDs and falls back to the raw OID', () => {
        expect(X509OidCatalog.attributeName('2.5.4.3')).toBe('CN')
        expect(X509OidCatalog.attributeName('2.5.4.6')).toBe('C')
        expect(X509OidCatalog.attributeName('2.5.4.7')).toBe('L')
        expect(X509OidCatalog.attributeName('2.5.4.8')).toBe('ST')
        expect(X509OidCatalog.attributeName('2.5.4.10')).toBe('O')
        expect(X509OidCatalog.attributeName('2.5.4.11')).toBe('OU')
        expect(X509OidCatalog.attributeName('1.2.840.113549.1.9.1')).toBe('emailAddress')
        expect(X509OidCatalog.attributeName('1.2.3.4.5')).toBe('1.2.3.4.5')
    })

    it('maps common signature algorithm OIDs and falls back to the raw OID', () => {
        expect(X509OidCatalog.signatureAlgorithmName('1.2.840.113549.1.1.11')).toBe('sha256WithRSAEncryption')
        expect(X509OidCatalog.signatureAlgorithmName('1.2.840.113549.1.1.12')).toBe('sha384WithRSAEncryption')
        expect(X509OidCatalog.signatureAlgorithmName('1.2.840.113549.1.1.13')).toBe('sha512WithRSAEncryption')
        expect(X509OidCatalog.signatureAlgorithmName('1.2.840.113549.1.1.5')).toBe('sha1WithRSAEncryption')
        expect(X509OidCatalog.signatureAlgorithmName('1.2.840.10045.4.3.2')).toBe('ecdsa-with-SHA256')
        expect(X509OidCatalog.signatureAlgorithmName('1.2.840.10045.4.3.3')).toBe('ecdsa-with-SHA384')
        expect(X509OidCatalog.signatureAlgorithmName('1.2.840.10045.4.3.4')).toBe('ecdsa-with-SHA512')
        expect(X509OidCatalog.signatureAlgorithmName('1.3.101.112')).toBe('Ed25519')
        expect(X509OidCatalog.signatureAlgorithmName('1.3.101.113')).toBe('Ed448')
        expect(X509OidCatalog.signatureAlgorithmName('1.2.840.113549.1.1.10')).toBe('RSASSA-PSS')
        expect(X509OidCatalog.signatureAlgorithmName('1.3.999.1')).toBe('1.3.999.1')
    })
})
