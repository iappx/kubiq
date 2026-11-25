import { describe, expect, it } from 'vitest'
import { KubeconfigUserEntity } from '@/domain/entities/kubeconfig'

const user = (data: Record<string, unknown>): KubeconfigUserEntity =>
    KubeconfigUserEntity.build({ name: 'someone', ...data })

describe('KubeconfigUserEntity', () => {
    it('reads a client certificate from inline data or from a file', () => {
        expect(user({ clientCertificateData: 'ZmFrZQ==' }).authType).toBe('clientCertificate')
        expect(user({ clientCertificate: 'pki/client.crt' }).authType).toBe('clientCertificate')
    })

    it('reads a bearer token from inline data or from a file', () => {
        expect(user({ token: 'fake-token' }).authType).toBe('token')
        expect(user({ tokenFile: 'pki/token' }).authType).toBe('token')
    })

    it('reads a user name as basic credentials', () => {
        expect(user({ username: 'lab', password: 'fake-password' }).authType).toBe('basic')
    })

    it('has no credentials when the entry carries none', () => {
        expect(user({}).authType).toBe('none')
        expect(user({}).isSupported).toBe(true)
    })

    it('lets a plugin answer for the whole entry', () => {
        expect(user({ usesExec: true, clientCertificateData: 'ZmFrZQ==' }).authType).toBe('exec')
        expect(user({ usesAuthProvider: true, token: 'fake-token' }).authType).toBe('authProvider')
    })

    it('supports exec plugins unless interactiveMode is Always', () => {
        expect(user({
            usesExec: true,
            execConfig: {
                apiVersion: 'client.authentication.k8s.io/v1',
                command: 'aws',
                args: ['eks', 'get-token'],
                env: [],
                installHint: '',
                interactiveMode: 'IfAvailable',
                provideClusterInfo: false,
            },
        }).isSupported).toBe(true)

        const interactive = user({
            usesExec: true,
            execConfig: {
                apiVersion: 'client.authentication.k8s.io/v1',
                command: 'kubelogin',
                args: [],
                env: [],
                installHint: '',
                interactiveMode: 'Always',
                provideClusterInfo: false,
            },
        })
        expect(interactive.isSupported).toBe(false)
        expect(interactive.unsupportedReason).toContain('non-interactively')
    })

    it('supports oidc auth-provider and rejects legacy providers with guidance', () => {
        expect(user({
            usesAuthProvider: true,
            authProvider: { name: 'oidc', config: {} },
        }).isSupported).toBe(true)

        const gcp = user({
            usesAuthProvider: true,
            authProvider: { name: 'gcp', config: {} },
        })
        expect(gcp.isSupported).toBe(false)
        expect(gcp.unsupportedReason).toContain('gcp')
        expect(gcp.unsupportedReason).toContain('exec')

        expect(user({ usesAuthProvider: true }).isSupported).toBe(false)
        expect(user({ token: 'fake-token' }).isSupported).toBe(true)
    })

    it('keeps the name as its primary key', () => {
        expect(user({}).getPkValue()).toBe('someone')
    })
})
