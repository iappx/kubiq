import { describe, expect, it } from 'vitest'
import { SecretEntity } from '@/domain/entities/config'
import { KubeObjectHealth } from '@/domain/entities/kube'
import { buildCertPem, textToBase64 } from './x509Fixture'

const toBase64 = textToBase64

const futureIso = (days: number): string => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

describe('SecretEntity TLS validity state', () => {
    it('stays stateless for non-TLS secrets and TLS secrets without data', () => {
        const opaque = SecretEntity.build({
            uid: 's-1',
            metadata: { uid: 's-1', name: 'app-config', namespace: 'default' },
            type: 'Opaque',
            data: { key: toBase64('value') },
        })
        const emptyTls = SecretEntity.build({
            uid: 's-2',
            metadata: { uid: 's-2', name: 'empty-tls', namespace: 'default' },
            type: 'kubernetes.io/tls',
        })

        expect(opaque.tlsChain).toBeNull()
        expect(opaque.state).toBeUndefined()
        expect(opaque.stateLabel).toBeUndefined()
        expect(KubeObjectHealth.hasState(opaque)).toBe(false)

        expect(emptyTls.tlsChain).toBeNull()
        expect(emptyTls.state).toBeUndefined()
        expect(emptyTls.stateLabel).toBeUndefined()
        expect(KubeObjectHealth.hasState(emptyTls)).toBe(false)
    })

    it('reports ok / Valid for a healthy kubernetes.io/tls secret', () => {
        const pem = buildCertPem({
            notBefore: futureIso(-10),
            notAfter: futureIso(90),
        })
        const secret = SecretEntity.build({
            uid: 's-ok',
            metadata: { uid: 's-ok', name: 'web-tls', namespace: 'prod' },
            type: 'kubernetes.io/tls',
            data: { 'tls.crt': toBase64(pem) },
        })

        expect(secret.tlsChain?.certificates).toHaveLength(1)
        expect(secret.state).toBe('ok')
        expect(secret.stateLabel).toBe('Valid')
        expect(KubeObjectHealth.hasState(secret)).toBe(true)
        expect(KubeObjectHealth.labelOf(secret)).toBe('Valid')
    })

    it('reports warning / Expiring soon when a certificate expires within 14 days', () => {
        const pem = buildCertPem({
            notBefore: futureIso(-30),
            notAfter: futureIso(5),
        })
        const secret = SecretEntity.build({
            uid: 's-warn',
            metadata: { uid: 's-warn', name: 'expiring-tls', namespace: 'prod' },
            type: 'kubernetes.io/tls',
            data: { 'tls.crt': toBase64(pem) },
        })

        expect(secret.state).toBe('warning')
        expect(secret.stateLabel).toBe('Expiring soon')
    })

    it('reports error / Expired when a certificate is past notAfter', () => {
        const pem = buildCertPem({
            notBefore: futureIso(-120),
            notAfter: futureIso(-2),
        })
        const secret = SecretEntity.build({
            uid: 's-err',
            metadata: { uid: 's-err', name: 'expired-tls', namespace: 'prod' },
            type: 'kubernetes.io/tls',
            data: { 'tls.crt': toBase64(pem) },
        })

        expect(secret.state).toBe('error')
        expect(secret.stateLabel).toBe('Expired')
    })
})
