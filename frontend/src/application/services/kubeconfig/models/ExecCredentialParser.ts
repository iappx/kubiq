import type { TExecCredential } from '@/application/services/kubeconfig/types/TExecCredential'
import type { KubeconfigClusterEntity } from '@/domain/entities/kubeconfig/KubeconfigClusterEntity'
import type { TKubeconfigExecConfig } from '@/domain/entities/kubeconfig/types/TKubeconfigExecConfig'
import { ApiError } from '@/domain/errors/ApiError'

export class ExecCredentialParser {
    public static readonly SupportedApiVersions: readonly string[] = [
        'client.authentication.k8s.io/v1',
        'client.authentication.k8s.io/v1beta1',
    ]

    public static readonly DefaultApiVersion: string = 'client.authentication.k8s.io/v1'

    private static readonly MaxErrorLineLength: number = 240

    private static readonly JwtPattern: RegExp = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g

    private static readonly BearerPattern: RegExp = /\bBearer\s+\S+/gi

    private static readonly SecretFieldPattern: RegExp =
        /\b(token|id[_-]?token|refresh[_-]?token|access[_-]?token|client[_-]?secret|password|key)\s*([=:])\s*\S+/gi

    private static readonly PemHeaderPattern: RegExp = /-----BEGIN [^-]+-----/

    public static parse(stdout: string): TExecCredential {
        const trimmed = stdout.trim()
        if (trimmed === '') {
            throw new ApiError('The exec credential plugin returned no output')
        }

        let parsed: unknown
        try {
            parsed = JSON.parse(trimmed)
        } catch {
            throw new ApiError('The exec credential plugin returned invalid JSON')
        }

        if (!ExecCredentialParser.isRecord(parsed) || parsed.kind !== 'ExecCredential') {
            throw new ApiError('The exec credential plugin did not return an ExecCredential object')
        }

        const apiVersion = typeof parsed.apiVersion === 'string' ? parsed.apiVersion : ''
        if (!ExecCredentialParser.SupportedApiVersions.includes(apiVersion)) {
            throw new ApiError(
                'The exec credential plugin returned an unsupported ExecCredential API version',
                apiVersion ? `apiVersion: ${apiVersion}` : undefined,
            )
        }

        const status = parsed.status
        if (!ExecCredentialParser.isRecord(status)) {
            throw new ApiError('The exec credential plugin returned no credential status')
        }

        const token = typeof status.token === 'string' ? status.token.trim() : ''
        const clientCertPem = typeof status.clientCertificateData === 'string' ? status.clientCertificateData : ''
        const clientKeyPem = typeof status.clientKeyData === 'string' ? status.clientKeyData : ''

        if ((clientCertPem !== '') !== (clientKeyPem !== '') && token === '') {
            throw new ApiError('The exec credential plugin returned an incomplete client certificate pair')
        }

        if (token === '' && clientCertPem === '' && clientKeyPem === '') {
            throw new ApiError('The exec credential plugin returned neither a token nor a client certificate')
        }

        return {
            token,
            clientCertPem,
            clientKeyPem,
            expiresAt: ExecCredentialParser.parseExpiration(status.expirationTimestamp),
        }
    }

    public static buildExecInfo(
        execConfig: TKubeconfigExecConfig,
        cluster?: KubeconfigClusterEntity,
    ): string {
        const apiVersion = execConfig.apiVersion || ExecCredentialParser.DefaultApiVersion
        const spec: Record<string, unknown> = { interactive: false }

        if (execConfig.provideClusterInfo && cluster) {
            const clusterInfo: Record<string, unknown> = {
                server: cluster.server,
            }
            if (cluster.tlsServerName) {
                clusterInfo.tlsServerName = cluster.tlsServerName
            }
            if (cluster.insecureSkipTlsVerify) {
                clusterInfo.insecureSkipTLSVerify = true
            }
            if (cluster.certificateAuthorityData) {
                clusterInfo.certificateAuthorityData = cluster.certificateAuthorityData
            }
            if (cluster.proxyUrl) {
                clusterInfo.proxyURL = cluster.proxyUrl
            }
            spec.cluster = clusterInfo
        }

        return JSON.stringify({
            apiVersion,
            kind: 'ExecCredential',
            spec,
        })
    }

    public static sanitizeStderr(stderr: string): string {
        const line = stderr
            .split(/\r?\n/)
            .map(entry => entry.trim())
            .find(entry => entry !== '')

        if (!line || ExecCredentialParser.PemHeaderPattern.test(line)) {
            return ''
        }

        const sanitized = line
            .replace(ExecCredentialParser.JwtPattern, '[redacted]')
            .replace(ExecCredentialParser.BearerPattern, 'Bearer [redacted]')
            .replace(ExecCredentialParser.SecretFieldPattern, '$1$2[redacted]')

        return sanitized.length > ExecCredentialParser.MaxErrorLineLength
            ? `${sanitized.slice(0, ExecCredentialParser.MaxErrorLineLength)}...`
            : sanitized
    }

    private static parseExpiration(value: unknown): number {
        if (typeof value !== 'string' || value.trim() === '') {
            return 0
        }

        const timestamp = Date.parse(value)
        return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0
    }

    private static isRecord(value: unknown): value is Record<string, unknown> {
        return !!value && typeof value === 'object' && !Array.isArray(value)
    }
}
