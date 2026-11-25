import { inject, singleton } from 'tsyringe'
import { OidcTokenReader } from '@/application/services/kubeconfig/models/OidcTokenReader'
import { KubeconfigAuthTypeCatalog } from '@/domain/entities/kubeconfig/KubeconfigAuthTypeCatalog'
import type { KubeconfigContextEntity } from '@/domain/entities/kubeconfig/KubeconfigContextEntity'
import type { TConnectionSpec } from '@/domain/entities/kubeconfig/types/TConnectionSpec'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeHttpAdapter } from '@/infrastructure/kube/KubeHttpAdapter'
import { KubeSessionAdapter } from '@/infrastructure/kube/KubeSessionAdapter'

@singleton()
export class KubeconfigOidcService {
    private static readonly RequestTimeoutSeconds: number = 15

    private readonly cache = new Map<string, { contextName: string; idToken: string; expiresAt: number }>()

    constructor(
        @inject(KubeSessionAdapter) private readonly sessionAdapter: KubeSessionAdapter,
        @inject(KubeHttpAdapter) private readonly httpAdapter: KubeHttpAdapter,
    ) {}

    public async resolve(context: KubeconfigContextEntity, caPem: string): Promise<string> {
        const user = context.user
        const provider = user?.authProvider

        if (!user || !provider || provider.name !== KubeconfigAuthTypeCatalog.SupportedAuthProvider) {
            throw new ApiError(
                `Kubeconfig context "${context.name}" cannot be used: ${user?.unsupportedReason || KubeconfigAuthTypeCatalog.UnsupportedAuthProviderReason}`,
            )
        }

        const key = `${context.filePath}|${context.name}|${user.name}`
        const cached = this.cachedOf(key)
        if (cached) {
            return cached
        }

        const idToken = (provider.config['id-token'] ?? '').trim()
        if (idToken !== '' && !OidcTokenReader.isExpired(idToken)) {
            return idToken
        }

        const issuerUrl = (provider.config['idp-issuer-url'] ?? '').trim()
        const clientId = (provider.config['client-id'] ?? '').trim()
        const clientSecret = (provider.config['client-secret'] ?? '').trim()
        const refreshToken = (provider.config['refresh-token'] ?? '').trim()

        if (!issuerUrl || !clientId || !refreshToken) {
            throw new ApiError(
                `OIDC credentials for context "${context.name}" have expired and cannot be refreshed automatically`,
                'Re-authenticate with kubectl or your OIDC provider',
            )
        }

        const refreshed = await this.refresh(
            context.name,
            issuerUrl,
            clientId,
            clientSecret,
            refreshToken,
            caPem,
            context.cluster?.proxyUrl ?? '',
        )

        if (refreshed.expiresAt > Date.now() + OidcTokenReader.DefaultSkewMs) {
            this.cache.set(key, {
                contextName: context.name,
                idToken: refreshed.idToken,
                expiresAt: refreshed.expiresAt,
            })
        }

        return refreshed.idToken
    }

    public forget(contextName?: string): void {
        if (contextName === undefined) {
            this.cache.clear()
            return
        }

        for (const [key, entry] of this.cache.entries()) {
            if (entry.contextName === contextName) {
                this.cache.delete(key)
            }
        }
    }

    private cachedOf(key: string): string | null {
        const entry = this.cache.get(key)
        if (!entry) {
            return null
        }

        if (entry.expiresAt === 0 || Date.now() < entry.expiresAt - OidcTokenReader.DefaultSkewMs) {
            return entry.idToken
        }

        this.cache.delete(key)
        return null
    }

    private async refresh(
        contextName: string,
        issuerUrl: string,
        clientId: string,
        clientSecret: string,
        refreshToken: string,
        caPem: string,
        proxyUrl: string,
    ): Promise<{ idToken: string; expiresAt: number }> {
        const discovery = OidcTokenReader.discoveryPath(issuerUrl)
        const discoverySession = await this.sessionAdapter.connect(
            KubeconfigOidcService.httpSpec(discovery.baseUrl, caPem, proxyUrl),
            `oidc:${contextName}`,
        )

        try {
            const discoveryResponse = await this.httpAdapter.send(discoverySession, {
                method: 'GET',
                url: discovery.path,
                headers: { accept: 'application/json' },
            })

            if (discoveryResponse.status < 200 || discoveryResponse.status >= 300) {
                throw new ApiError(
                    `OIDC discovery failed for context "${contextName}" (HTTP ${discoveryResponse.status})`,
                    OidcTokenReader.extractSafeError(discoveryResponse.data) || undefined,
                    discoveryResponse.status,
                )
            }

            const tokenEndpoint = OidcTokenReader.splitUrl(OidcTokenReader.parseDiscovery(discoveryResponse.data))
            const request = {
                method: 'POST' as const,
                url: tokenEndpoint.path,
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    accept: 'application/json',
                },
                body: OidcTokenReader.refreshBody({
                    clientId,
                    clientSecret: clientSecret || undefined,
                    refreshToken,
                }),
            }

            const tokenResponse = tokenEndpoint.baseUrl === discovery.baseUrl
                ? await this.httpAdapter.send(discoverySession, request)
                : await this.sendWithTemporarySession(tokenEndpoint.baseUrl, caPem, proxyUrl, contextName, request)

            if (tokenResponse.status < 200 || tokenResponse.status >= 300) {
                throw new ApiError(
                    `OIDC token refresh failed for context "${contextName}" (HTTP ${tokenResponse.status})`,
                    OidcTokenReader.extractSafeError(tokenResponse.data) || 'Re-authenticate with kubectl or your OIDC provider',
                    tokenResponse.status,
                )
            }

            return OidcTokenReader.parseTokenResponse(tokenResponse.data)
        } finally {
            await this.disconnectQuietly(discoverySession)
        }
    }

    private async sendWithTemporarySession(
        baseUrl: string,
        caPem: string,
        proxyUrl: string,
        contextName: string,
        request: { method: 'POST'; url: string; headers: Record<string, string>; body: string },
    ) {
        const sessionId = await this.sessionAdapter.connect(
            KubeconfigOidcService.httpSpec(baseUrl, caPem, proxyUrl),
            `oidc:${contextName}`,
        )

        try {
            return await this.httpAdapter.send(sessionId, request)
        } finally {
            await this.disconnectQuietly(sessionId)
        }
    }

    private async disconnectQuietly(sessionId: string): Promise<void> {
        try {
            await this.sessionAdapter.disconnect(sessionId)
        } catch {
            return
        }
    }

    private static httpSpec(server: string, caPem: string, proxyUrl: string): TConnectionSpec {
        return {
            server,
            caPem,
            clientCertPem: '',
            clientKeyPem: '',
            token: '',
            username: '',
            password: '',
            insecureSkipTlsVerify: false,
            serverName: '',
            proxyUrl,
            timeoutSeconds: KubeconfigOidcService.RequestTimeoutSeconds,
        }
    }
}
