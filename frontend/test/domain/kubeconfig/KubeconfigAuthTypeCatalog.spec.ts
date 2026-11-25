import { describe, expect, it } from 'vitest'
import { KubeconfigAuthTypeCatalog } from '@/domain/entities/kubeconfig'

describe('KubeconfigAuthTypeCatalog', () => {
    it('names every authentication method it knows', () => {
        expect(KubeconfigAuthTypeCatalog.title('clientCertificate')).toBe('Client certificate')
        expect(KubeconfigAuthTypeCatalog.title('token')).toBe('Bearer token')
        expect(KubeconfigAuthTypeCatalog.has('basic')).toBe(true)
        expect(KubeconfigAuthTypeCatalog.has('smartcard')).toBe(false)
    })

    it('supports certificates, tokens, basic credentials, exec plugins, auth providers and anonymous access', () => {
        expect(KubeconfigAuthTypeCatalog.isSupported('clientCertificate')).toBe(true)
        expect(KubeconfigAuthTypeCatalog.isSupported('token')).toBe(true)
        expect(KubeconfigAuthTypeCatalog.isSupported('basic')).toBe(true)
        expect(KubeconfigAuthTypeCatalog.isSupported('exec')).toBe(true)
        expect(KubeconfigAuthTypeCatalog.isSupported('authProvider')).toBe(true)
        expect(KubeconfigAuthTypeCatalog.isSupported('none')).toBe(true)
    })

    it('reports specific reasons for interactive exec plugins and non-OIDC auth providers', () => {
        expect(KubeconfigAuthTypeCatalog.unsupportedReasonFor('exec', {
            apiVersion: 'client.authentication.k8s.io/v1',
            command: 'kubelogin',
            args: [],
            env: [],
            installHint: '',
            interactiveMode: 'Always',
            provideClusterInfo: false,
        })).toContain('non-interactively')

        expect(KubeconfigAuthTypeCatalog.unsupportedReasonFor('exec', {
            apiVersion: 'client.authentication.k8s.io/v1',
            command: 'aws',
            args: [],
            env: [],
            installHint: '',
            interactiveMode: 'IfAvailable',
            provideClusterInfo: false,
        })).toBe('')

        expect(KubeconfigAuthTypeCatalog.unsupportedReasonFor('authProvider', undefined, {
            name: 'oidc',
            config: {},
        })).toBe('')

        const legacyReason = KubeconfigAuthTypeCatalog.unsupportedReasonFor('authProvider', undefined, {
            name: 'gcp',
            config: {},
        })
        expect(legacyReason).toContain('gcp')
        expect(legacyReason).toContain('exec')
    })

    it('has no reason to give for a method it supports', () => {
        expect(KubeconfigAuthTypeCatalog.reason('token')).toBe('')
        expect(KubeconfigAuthTypeCatalog.reason('exec')).toBe('')
    })
})
