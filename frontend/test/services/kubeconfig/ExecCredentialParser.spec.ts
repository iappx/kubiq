import { describe, expect, it } from 'vitest'
import { ExecCredentialParser } from '@/application/services/kubeconfig/models/ExecCredentialParser'
import { KubeconfigClusterEntity } from '@/domain/entities/kubeconfig/KubeconfigClusterEntity'
import { ApiError } from '@/domain/errors/ApiError'

const failure = (action: () => unknown): ApiError => {
    let caught: unknown
    try {
        action()
    } catch (err) {
        caught = err
    }
    expect(caught).toBeInstanceOf(ApiError)
    return caught as ApiError
}

describe('ExecCredentialParser', () => {
    it('parses v1 ExecCredential with bearer token and expirationTimestamp', () => {
        const expiration = '2030-06-15T12:00:00Z'
        const credential = ExecCredentialParser.parse(JSON.stringify({
            apiVersion: 'client.authentication.k8s.io/v1',
            kind: 'ExecCredential',
            status: {
                token: '  fake-exec-token  ',
                expirationTimestamp: expiration,
            },
        }))

        expect(credential).toEqual({
            token: 'fake-exec-token',
            clientCertPem: '',
            clientKeyPem: '',
            expiresAt: Date.parse(expiration),
        })
    })

    it('parses v1beta1 ExecCredential with client certificate and key data', () => {
        const credential = ExecCredentialParser.parse(JSON.stringify({
            apiVersion: 'client.authentication.k8s.io/v1beta1',
            kind: 'ExecCredential',
            status: {
                clientCertificateData: '-----BEGIN CERTIFICATE-----\nfake-cert\n-----END CERTIFICATE-----',
                clientKeyData: '-----BEGIN PRIVATE KEY-----\nfake-key\n-----END PRIVATE KEY-----',
            },
        }))

        expect(credential.token).toBe('')
        expect(credential.clientCertPem).toContain('fake-cert')
        expect(credential.clientKeyPem).toContain('fake-key')
        expect(credential.expiresAt).toBe(0)
    })

    it('rejects empty output, invalid JSON, wrong kind, unsupported apiVersion, and empty status without echoing stdout', () => {
        expect(failure(() => ExecCredentialParser.parse('   ')).message).toContain('no output')

        const badJson = failure(() => ExecCredentialParser.parse('not-json fake-secret-payload'))
        expect(badJson.message).toContain('invalid JSON')
        expect(`${badJson.message} ${badJson.details ?? ''}`).not.toContain('fake-secret-payload')

        const wrongKind = failure(() => ExecCredentialParser.parse(JSON.stringify({
            apiVersion: 'client.authentication.k8s.io/v1',
            kind: 'Secret',
            status: { token: 'fake-leaked-token' },
        })))
        expect(wrongKind.message).toContain('ExecCredential')
        expect(`${wrongKind.message} ${wrongKind.details ?? ''}`).not.toContain('fake-leaked-token')

        const wrongVersion = failure(() => ExecCredentialParser.parse(JSON.stringify({
            apiVersion: 'client.authentication.k8s.io/v1alpha1',
            kind: 'ExecCredential',
            status: { token: 'fake-leaked-token' },
        })))
        expect(wrongVersion.message).toContain('unsupported')
        expect(wrongVersion.details).toContain('v1alpha1')
        expect(`${wrongVersion.message} ${wrongVersion.details ?? ''}`).not.toContain('fake-leaked-token')

        const missingCreds = failure(() => ExecCredentialParser.parse(JSON.stringify({
            apiVersion: 'client.authentication.k8s.io/v1',
            kind: 'ExecCredential',
            status: {},
        })))
        expect(missingCreds.message).toContain('neither a token nor a client certificate')

        const partialCert = failure(() => ExecCredentialParser.parse(JSON.stringify({
            apiVersion: 'client.authentication.k8s.io/v1',
            kind: 'ExecCredential',
            status: { clientCertificateData: 'fake-cert-only' },
        })))
        expect(partialCert.message).toContain('incomplete client certificate')
    })

    it('builds KUBERNETES_EXEC_INFO without cluster info unless provideClusterInfo is enabled', () => {
        const cluster = KubeconfigClusterEntity.build({
            name: 'eks-prod',
            server: 'https://eks.example.internal:6443',
            certificateAuthorityData: 'ZmFrZS1jYQ==',
            tlsServerName: 'eks.internal',
            proxyUrl: 'http://proxy.internal:3128',
            insecureSkipTlsVerify: false,
        })

        const basic = JSON.parse(ExecCredentialParser.buildExecInfo({
            apiVersion: 'client.authentication.k8s.io/v1beta1',
            command: 'aws',
            args: [],
            env: [],
            installHint: '',
            interactiveMode: 'IfAvailable',
            provideClusterInfo: false,
        }, cluster))

        expect(basic).toEqual({
            apiVersion: 'client.authentication.k8s.io/v1beta1',
            kind: 'ExecCredential',
            spec: { interactive: false },
        })

        const withCluster = JSON.parse(ExecCredentialParser.buildExecInfo({
            apiVersion: '',
            command: 'aws',
            args: [],
            env: [],
            installHint: '',
            interactiveMode: 'IfAvailable',
            provideClusterInfo: true,
        }, cluster))

        expect(withCluster).toEqual({
            apiVersion: 'client.authentication.k8s.io/v1',
            kind: 'ExecCredential',
            spec: {
                interactive: false,
                cluster: {
                    server: 'https://eks.example.internal:6443',
                    tlsServerName: 'eks.internal',
                    certificateAuthorityData: 'ZmFrZS1jYQ==',
                    proxyURL: 'http://proxy.internal:3128',
                },
            },
        })
    })

    it('sanitizes stderr lines to prevent token or PEM leakage', () => {
        expect(ExecCredentialParser.sanitizeStderr('\n  ExpiredToken: profile prod failed\nsecond line'))
            .toBe('ExpiredToken: profile prod failed')

        const bearer = ExecCredentialParser.sanitizeStderr('Authorization: Bearer fake-secret-bearer')
        expect(bearer).not.toContain('fake-secret-bearer')
        expect(bearer).toContain('Bearer [redacted]')

        const assigned = ExecCredentialParser.sanitizeStderr('failed refresh_token=fake-refresh-secret')
        expect(assigned).not.toContain('fake-refresh-secret')

        expect(ExecCredentialParser.sanitizeStderr('-----BEGIN PRIVATE KEY-----\nfake')).toBe('')
    })
})
