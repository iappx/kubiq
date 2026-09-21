import { describe, expect, it } from 'vitest'
import { KubeconfigAuthTypeCatalog } from '@/domain/entities/kubeconfig'

describe('KubeconfigAuthTypeCatalog', () => {
    it('names every authentication method it knows', () => {
        expect(KubeconfigAuthTypeCatalog.title('clientCertificate')).toBe('Client certificate')
        expect(KubeconfigAuthTypeCatalog.title('token')).toBe('Bearer token')
        expect(KubeconfigAuthTypeCatalog.has('basic')).toBe(true)
        expect(KubeconfigAuthTypeCatalog.has('smartcard')).toBe(false)
    })

    it('supports certificates, tokens, basic credentials and anonymous access', () => {
        expect(KubeconfigAuthTypeCatalog.isSupported('clientCertificate')).toBe(true)
        expect(KubeconfigAuthTypeCatalog.isSupported('token')).toBe(true)
        expect(KubeconfigAuthTypeCatalog.isSupported('basic')).toBe(true)
        expect(KubeconfigAuthTypeCatalog.isSupported('none')).toBe(true)
    })

    it('refuses the plugin methods and says why in plain words', () => {
        expect(KubeconfigAuthTypeCatalog.isSupported('exec')).toBe(false)
        expect(KubeconfigAuthTypeCatalog.isSupported('authProvider')).toBe(false)
        expect(KubeconfigAuthTypeCatalog.reason('exec')).toContain('later version')
        expect(KubeconfigAuthTypeCatalog.reason('authProvider')).toContain('later version')
    })

    it('has no reason to give for a method it supports', () => {
        expect(KubeconfigAuthTypeCatalog.reason('token')).toBe('')
    })
})
