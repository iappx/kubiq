import { describe, expect, it } from 'vitest'
import { OidcTokenReader } from '@/application/services/kubeconfig/models/OidcTokenReader'
import { ApiError } from '@/domain/errors/ApiError'
import { Base64 } from '@/lib/encoding/Base64'

const toBase64Url = (value: string): string =>
    Base64.stringToB64(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fakeJwt = (payload: Record<string, unknown>): string =>
    `${toBase64Url('{"alg":"RS256"}')}.${toBase64Url(JSON.stringify(payload))}.fake-sig`

describe('OidcTokenReader', () => {
    it('extracts JWT expiration in milliseconds and evaluates expiry with skew', () => {
        const expSeconds = 1_800_000_000
        const jwt = fakeJwt({ sub: 'alice', exp: expSeconds })

        expect(OidcTokenReader.expiresAt(jwt)).toBe(expSeconds * 1000)
        expect(OidcTokenReader.isExpired(jwt, expSeconds * 1000 - 120_000)).toBe(false)
        expect(OidcTokenReader.isExpired(jwt, expSeconds * 1000 - 30_000)).toBe(true)
        expect(OidcTokenReader.isExpired(jwt, expSeconds * 1000 + 10_000)).toBe(true)
    })

    it('returns 0 for malformed or exp-less tokens', () => {
        expect(OidcTokenReader.expiresAt('not-a-jwt')).toBe(0)
        expect(OidcTokenReader.expiresAt(fakeJwt({ sub: 'alice' }))).toBe(0)
        expect(OidcTokenReader.isExpired('opaque-token', Date.now())).toBe(false)
    })

    it('splits issuer URLs into origin and well-known discovery path', () => {
        expect(OidcTokenReader.discoveryPath('https://auth.example.internal')).toEqual({
            baseUrl: 'https://auth.example.internal',
            path: '/.well-known/openid-configuration',
        })

        expect(OidcTokenReader.discoveryPath('https://auth.example.internal/realms/prod/')).toEqual({
            baseUrl: 'https://auth.example.internal',
            path: '/realms/prod/.well-known/openid-configuration',
        })

        expect(() => OidcTokenReader.discoveryPath('ftp://bad.internal')).toThrow(ApiError)
        expect(() => OidcTokenReader.discoveryPath('not a url')).toThrow(ApiError)
    })

    it('encodes refresh grant form body with optional client_secret', () => {
        const withSecret = new URLSearchParams(OidcTokenReader.refreshBody({
            clientId: 'kubiq',
            clientSecret: 'fake-client-secret',
            refreshToken: 'fake-refresh-token',
        }))

        expect(withSecret.get('grant_type')).toBe('refresh_token')
        expect(withSecret.get('client_id')).toBe('kubiq')
        expect(withSecret.get('client_secret')).toBe('fake-client-secret')
        expect(withSecret.get('refresh_token')).toBe('fake-refresh-token')

        const publicClient = new URLSearchParams(OidcTokenReader.refreshBody({
            clientId: 'kubiq',
            refreshToken: 'fake-refresh-token',
        }))

        expect(publicClient.has('client_secret')).toBe(false)
    })

    it('parses discovery and token responses safely without leaking raw payloads on error', () => {
        expect(OidcTokenReader.parseDiscovery(JSON.stringify({
            token_endpoint: 'https://auth.example.internal/oauth/token',
        }))).toBe('https://auth.example.internal/oauth/token')

        expect(() => OidcTokenReader.parseDiscovery('{}')).toThrow(ApiError)

        const expSeconds = 1_900_000_000
        const idToken = fakeJwt({ exp: expSeconds })
        expect(OidcTokenReader.parseTokenResponse(JSON.stringify({
            id_token: idToken,
            access_token: 'fake-access-token',
        }))).toEqual({
            idToken,
            expiresAt: expSeconds * 1000,
        })

        const fallback = OidcTokenReader.parseTokenResponse(JSON.stringify({
            access_token: 'fake-access-token',
            expires_in: 600,
        }))
        expect(fallback.idToken).toBe('fake-access-token')
        expect(fallback.expiresAt).toBeGreaterThan(Date.now())

        let caught: unknown
        try {
            OidcTokenReader.parseTokenResponse('invalid-json fake-secret-body')
        } catch (err) {
            caught = err
        }
        expect(caught).toBeInstanceOf(ApiError)
        expect(`${(caught as ApiError).message} ${(caught as ApiError).details ?? ''}`)
            .not.toContain('fake-secret-body')
    })
})
