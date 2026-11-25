import { ApiError } from '@/domain/errors/ApiError'
import { Base64 } from '@/lib/encoding/Base64'

export class OidcTokenReader {
    public static readonly DefaultSkewMs: number = 60_000

    private static readonly MaxErrorLength: number = 240

    public static expiresAt(jwt: string): number {
        const parts = jwt.trim().split('.')
        if (parts.length !== 3 || parts[1] === '') {
            return 0
        }

        try {
            const decoded = Base64.b64ToString(OidcTokenReader.fromBase64Url(parts[1]))
            const payload: unknown = JSON.parse(decoded)
            if (!OidcTokenReader.isRecord(payload)) {
                return 0
            }

            const exp = payload.exp
            return typeof exp === 'number' && Number.isFinite(exp) && exp > 0 ? exp * 1000 : 0
        } catch {
            return 0
        }
    }

    public static isExpired(
        jwt: string,
        now: number = Date.now(),
        skewMs: number = OidcTokenReader.DefaultSkewMs,
    ): boolean {
        const exp = OidcTokenReader.expiresAt(jwt)
        return exp > 0 && now >= exp - skewMs
    }

    public static discoveryPath(issuerUrl: string): { baseUrl: string; path: string } {
        const parsed = OidcTokenReader.parseHttpUrl(issuerUrl, 'The OIDC issuer URL is not valid')
        const pathname = parsed.pathname.replace(/\/+$/, '')

        return {
            baseUrl: parsed.origin,
            path: `${pathname}/.well-known/openid-configuration`,
        }
    }

    public static splitUrl(endpointUrl: string): { baseUrl: string; path: string } {
        const parsed = OidcTokenReader.parseHttpUrl(endpointUrl, 'The OIDC token endpoint URL is not valid')

        return {
            baseUrl: parsed.origin,
            path: `${parsed.pathname}${parsed.search}`,
        }
    }

    public static refreshBody(params: {
        clientId: string
        clientSecret?: string
        refreshToken: string
    }): string {
        const form = new URLSearchParams()
        form.set('grant_type', 'refresh_token')
        form.set('client_id', params.clientId)
        if (params.clientSecret) {
            form.set('client_secret', params.clientSecret)
        }
        form.set('refresh_token', params.refreshToken)

        return form.toString()
    }

    public static parseDiscovery(body: string): string {
        let parsed: unknown
        try {
            parsed = JSON.parse(body)
        } catch {
            throw new ApiError('The OIDC discovery document was not valid JSON')
        }

        if (!OidcTokenReader.isRecord(parsed) || typeof parsed.token_endpoint !== 'string' || parsed.token_endpoint.trim() === '') {
            throw new ApiError('The OIDC discovery document did not include a token endpoint')
        }

        return parsed.token_endpoint.trim()
    }

    public static parseTokenResponse(body: string): { idToken: string; expiresAt: number } {
        let parsed: unknown
        try {
            parsed = JSON.parse(body)
        } catch {
            throw new ApiError('The OIDC token endpoint returned invalid JSON')
        }

        if (!OidcTokenReader.isRecord(parsed)) {
            throw new ApiError('The OIDC token endpoint did not return a JSON object')
        }

        const idToken = typeof parsed.id_token === 'string' && parsed.id_token.trim() !== ''
            ? parsed.id_token.trim()
            : (typeof parsed.access_token === 'string' ? parsed.access_token.trim() : '')

        if (idToken === '') {
            throw new ApiError('The OIDC token endpoint did not return an ID token')
        }

        let expiresAt = OidcTokenReader.expiresAt(idToken)
        if (expiresAt === 0 && typeof parsed.expires_in === 'number' && Number.isFinite(parsed.expires_in) && parsed.expires_in > 0) {
            expiresAt = Date.now() + parsed.expires_in * 1000
        }

        return { idToken, expiresAt }
    }

    public static extractSafeError(body: string): string {
        try {
            const parsed: unknown = JSON.parse(body)
            if (!OidcTokenReader.isRecord(parsed)) {
                return ''
            }

            const code = typeof parsed.error === 'string' ? parsed.error.trim() : ''
            const description = typeof parsed.error_description === 'string' ? parsed.error_description.trim() : ''
            const combined = [code, description].filter(part => part !== '').join(': ')

            return combined.length > OidcTokenReader.MaxErrorLength
                ? `${combined.slice(0, OidcTokenReader.MaxErrorLength)}...`
                : combined
        } catch {
            return ''
        }
    }

    private static parseHttpUrl(raw: string, message: string): URL {
        let parsed: URL
        try {
            parsed = new URL(raw.trim())
        } catch {
            throw new ApiError(message)
        }

        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new ApiError(message)
        }

        return parsed
    }

    private static fromBase64Url(segment: string): string {
        const standard = segment.replace(/-/g, '+').replace(/_/g, '/')
        const remainder = standard.length % 4
        return remainder === 0 ? standard : standard + '='.repeat(4 - remainder)
    }

    private static isRecord(value: unknown): value is Record<string, unknown> {
        return !!value && typeof value === 'object' && !Array.isArray(value)
    }
}
