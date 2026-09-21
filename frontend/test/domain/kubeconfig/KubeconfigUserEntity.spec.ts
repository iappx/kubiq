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

    it('marks the plugin methods as unsupported', () => {
        expect(user({ usesExec: true }).isSupported).toBe(false)
        expect(user({ usesAuthProvider: true }).isSupported).toBe(false)
        expect(user({ token: 'fake-token' }).isSupported).toBe(true)
    })

    it('keeps the name as its primary key', () => {
        expect(user({}).getPkValue()).toBe('someone')
    })
})
