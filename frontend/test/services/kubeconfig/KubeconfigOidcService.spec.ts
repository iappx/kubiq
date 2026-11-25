import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const connect = vi.fn()
const disconnect = vi.fn()
const send = vi.fn()

vi.mock('../../../bindings/iappx_k8s_admin/core/services/kube', () => ({
    ConnectionService: {
        Connect: (...args: unknown[]) => connect(...args),
        Disconnect: (...args: unknown[]) => disconnect(...args),
        Sessions: () => Promise.resolve({ success: true, sessions: [] }),
        ResetIdle: () => Promise.resolve({ success: true }),
    },
    KubeService: {
        Send: (...args: unknown[]) => send(...args),
    },
    Request: class {
        constructor(source: Record<string, unknown>) {
            Object.assign(this, source)
        }
    },
}))

import { KubeconfigOidcService } from '@/application/services/kubeconfig/KubeconfigOidcService'
import { KubeconfigContextEntity } from '@/domain/entities/kubeconfig/KubeconfigContextEntity'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeHttpAdapter } from '@/infrastructure/kube/KubeHttpAdapter'
import { KubeSessionAdapter } from '@/infrastructure/kube/KubeSessionAdapter'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'
import { Base64 } from '@/lib/encoding/Base64'

const runtime = { isAvailable: () => true } as WailsRuntimeService

const toBase64Url = (value: string): string =>
    Base64.stringToB64(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fakeJwt = (expSeconds: number): string =>
    `${toBase64Url('{"alg":"RS256"}')}.${toBase64Url(JSON.stringify({ sub: 'alice', exp: expSeconds }))}.fake-sig`

const buildContext = (config: Record<string, string>, providerName = 'oidc'): KubeconfigContextEntity =>
    KubeconfigContextEntity.build({
        name: 'oidc-prod',
        clusterName: 'oidc-prod',
        userName: 'oidc-user',
        filePath: 'C:/Users/tester/.kube/config',
        cluster: {
            name: 'oidc-prod',
            server: 'https://cluster.example.internal:6443',
            proxyUrl: 'http://proxy.internal:3128',
            filePath: 'C:/Users/tester/.kube/config',
        },
        user: {
            name: 'oidc-user',
            usesAuthProvider: true,
            authProvider: { name: providerName, config },
            filePath: 'C:/Users/tester/.kube/config',
        },
    })

let service: KubeconfigOidcService

describe('KubeconfigOidcService', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))
        connect.mockReset()
        disconnect.mockReset()
        send.mockReset()
        disconnect.mockResolvedValue({ success: true })

        service = new KubeconfigOidcService(
            new KubeSessionAdapter(runtime),
            new KubeHttpAdapter(runtime),
        )
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns a valid non-expired id-token directly without network calls', async () => {
        const validToken = fakeJwt(Math.floor(Date.parse('2026-06-01T13:00:00Z') / 1000))
        const context = buildContext({ 'id-token': validToken })

        await expect(service.resolve(context, '')).resolves.toBe(validToken)
        expect(connect).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalled()
    })

    it('refreshes an expired id-token via discovery and token endpoint through Go sessions, caches it, and closes temporary sessions', async () => {
        const expiredToken = fakeJwt(Math.floor(Date.parse('2026-06-01T11:00:00Z') / 1000))
        const refreshedToken = fakeJwt(Math.floor(Date.parse('2026-06-01T13:00:00Z') / 1000))

        connect.mockResolvedValueOnce({ success: true, sessionId: 'oidc-session-1' })
        send
            .mockResolvedValueOnce({
                success: true,
                status: 200,
                headers: {},
                body: JSON.stringify({
                    token_endpoint: 'https://idp.example.internal/realms/prod/protocol/openid-connect/token',
                }),
                error: '',
            })
            .mockResolvedValueOnce({
                success: true,
                status: 200,
                headers: {},
                body: JSON.stringify({ id_token: refreshedToken }),
                error: '',
            })

        const context = buildContext({
            'id-token': expiredToken,
            'idp-issuer-url': 'https://idp.example.internal/realms/prod',
            'client-id': 'kubiq-cli',
            'client-secret': 'fake-client-secret',
            'refresh-token': 'fake-refresh-token',
        })

        const first = await service.resolve(context, '-----BEGIN CERTIFICATE-----\nfake-idp-ca\n-----END CERTIFICATE-----')
        expect(first).toBe(refreshedToken)
        expect(connect).toHaveBeenCalledTimes(1)
        expect(connect.mock.calls[0][0].server).toBe('https://idp.example.internal')
        expect(connect.mock.calls[0][0].caPem).toContain('fake-idp-ca')
        expect(connect.mock.calls[0][0].proxyUrl).toBe('http://proxy.internal:3128')

        expect(send).toHaveBeenCalledTimes(2)
        expect(send.mock.calls[0][0].method).toBe('GET')
        expect(send.mock.calls[0][0].path).toBe('/realms/prod/.well-known/openid-configuration')
        expect(send.mock.calls[1][0].method).toBe('POST')
        expect(send.mock.calls[1][0].path).toBe('/realms/prod/protocol/openid-connect/token')
        expect(send.mock.calls[1][0].headers['content-type']).toBe('application/x-www-form-urlencoded')
        expect(send.mock.calls[1][0].body).toContain('grant_type=refresh_token')
        expect(send.mock.calls[1][0].body).toContain('refresh_token=fake-refresh-token')
        expect(disconnect).toHaveBeenCalledWith('oidc-session-1')

        const cached = await service.resolve(context, '')
        expect(cached).toBe(refreshedToken)
        expect(connect).toHaveBeenCalledTimes(1)
    })

    it('opens a second temporary session when token_endpoint is on a different origin and closes both', async () => {
        const refreshedToken = fakeJwt(Math.floor(Date.parse('2026-06-01T13:00:00Z') / 1000))

        connect
            .mockResolvedValueOnce({ success: true, sessionId: 'oidc-discovery-1' })
            .mockResolvedValueOnce({ success: true, sessionId: 'oidc-token-2' })
        send
            .mockResolvedValueOnce({
                success: true,
                status: 200,
                headers: {},
                body: JSON.stringify({ token_endpoint: 'https://tokens.other.internal/oauth2/token' }),
                error: '',
            })
            .mockResolvedValueOnce({
                success: true,
                status: 200,
                headers: {},
                body: JSON.stringify({ id_token: refreshedToken }),
                error: '',
            })

        const context = buildContext({
            'idp-issuer-url': 'https://idp.example.internal',
            'client-id': 'kubiq',
            'refresh-token': 'fake-refresh-token',
        })

        await expect(service.resolve(context, '')).resolves.toBe(refreshedToken)
        expect(connect).toHaveBeenCalledTimes(2)
        expect(connect.mock.calls[1][0].server).toBe('https://tokens.other.internal')
        expect(disconnect).toHaveBeenCalledWith('oidc-token-2')
        expect(disconnect).toHaveBeenCalledWith('oidc-discovery-1')
    })

    it('throws a clear ApiError when id-token is expired and refresh parameters are missing', async () => {
        const expiredToken = fakeJwt(Math.floor(Date.parse('2026-06-01T10:00:00Z') / 1000))
        const context = buildContext({
            'id-token': expiredToken,
            'idp-issuer-url': 'https://idp.example.internal',
            'client-id': 'kubiq',
        })

        const err = await service.resolve(context, '').catch(e => e)
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).message).toContain('expired')
        expect((err as ApiError).details).toContain('kubectl')
        expect(`${(err as ApiError).message} ${(err as ApiError).details}`).not.toContain(expiredToken)
    })

    it('disconnects temporary session and hides sensitive values when token refresh returns HTTP 400', async () => {
        connect.mockResolvedValueOnce({ success: true, sessionId: 'oidc-fail-1' })
        send
            .mockResolvedValueOnce({
                success: true,
                status: 200,
                headers: {},
                body: JSON.stringify({ token_endpoint: 'https://idp.example.internal/token' }),
                error: '',
            })
            .mockResolvedValueOnce({
                success: false,
                status: 400,
                headers: {},
                body: JSON.stringify({ error: 'invalid_grant', error_description: 'Refresh token revoked' }),
                error: '',
            })

        const context = buildContext({
            'idp-issuer-url': 'https://idp.example.internal',
            'client-id': 'kubiq',
            'client-secret': 'fake-secret-never-logged',
            'refresh-token': 'fake-refresh-never-logged',
        })

        const err = await service.resolve(context, '').catch(e => e)
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).message).toContain('HTTP 400')
        expect((err as ApiError).details).toContain('invalid_grant')
        expect(`${(err as ApiError).message} ${(err as ApiError).details}`).not.toContain('fake-secret-never-logged')
        expect(`${(err as ApiError).message} ${(err as ApiError).details}`).not.toContain('fake-refresh-never-logged')
        expect(disconnect).toHaveBeenCalledWith('oidc-fail-1')
    })

    it('forgets cached tokens when forget is called', async () => {
        const token1 = fakeJwt(Math.floor(Date.parse('2026-06-01T13:00:00Z') / 1000))
        const token2 = fakeJwt(Math.floor(Date.parse('2026-06-01T14:00:00Z') / 1000))

        connect
            .mockResolvedValueOnce({ success: true, sessionId: 's1' })
            .mockResolvedValueOnce({ success: true, sessionId: 's2' })
        send
            .mockResolvedValueOnce({
                success: true,
                status: 200,
                headers: {},
                body: JSON.stringify({ token_endpoint: 'https://idp.example.internal/token' }),
                error: '',
            })
            .mockResolvedValueOnce({
                success: true,
                status: 200,
                headers: {},
                body: JSON.stringify({ id_token: token1 }),
                error: '',
            })
            .mockResolvedValueOnce({
                success: true,
                status: 200,
                headers: {},
                body: JSON.stringify({ token_endpoint: 'https://idp.example.internal/token' }),
                error: '',
            })
            .mockResolvedValueOnce({
                success: true,
                status: 200,
                headers: {},
                body: JSON.stringify({ id_token: token2 }),
                error: '',
            })

        const context = buildContext({
            'idp-issuer-url': 'https://idp.example.internal',
            'client-id': 'kubiq',
            'refresh-token': 'fake-refresh-token',
        })

        expect(await service.resolve(context, '')).toBe(token1)
        service.forget('oidc-prod')
        expect(await service.resolve(context, '')).toBe(token2)
    })
})
