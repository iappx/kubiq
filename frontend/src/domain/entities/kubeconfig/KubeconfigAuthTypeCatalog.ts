import type { TKubeconfigAuthType } from '@/domain/entities/kubeconfig/types/TKubeconfigAuthType'

export class KubeconfigAuthTypeCatalog {
    public static readonly values: Record<TKubeconfigAuthType, string> = {
        clientCertificate: 'Client certificate',
        token: 'Bearer token',
        basic: 'User name and password',
        exec: 'Exec credential plugin',
        authProvider: 'Auth provider plugin',
        none: 'No credentials',
    }

    private static readonly reasons: Partial<Record<TKubeconfigAuthType, string>> = {
        exec: 'this context runs an external command to obtain its credentials, and exec credential plugins arrive in a later version',
        authProvider: 'this context relies on an auth provider plugin such as OIDC, and those arrive in a later version',
    }

    public static title(type: TKubeconfigAuthType): string {
        return KubeconfigAuthTypeCatalog.values[type] ?? type
    }

    public static has(type: string): boolean {
        return Object.prototype.hasOwnProperty.call(KubeconfigAuthTypeCatalog.values, type)
    }

    public static isSupported(type: TKubeconfigAuthType): boolean {
        return !KubeconfigAuthTypeCatalog.reasons[type]
    }

    public static reason(type: TKubeconfigAuthType): string {
        return KubeconfigAuthTypeCatalog.reasons[type] ?? ''
    }
}
