import type { TKubeconfigAuthProvider } from '@/domain/entities/kubeconfig/types/TKubeconfigAuthProvider'
import type { TKubeconfigAuthType } from '@/domain/entities/kubeconfig/types/TKubeconfigAuthType'
import type { TKubeconfigExecConfig } from '@/domain/entities/kubeconfig/types/TKubeconfigExecConfig'

export class KubeconfigAuthTypeCatalog {
    public static readonly SupportedAuthProvider: string = 'oidc'

    public static readonly InteractiveExecMode: string = 'Always'

    public static readonly InteractiveExecReason: string =
        'this context uses an interactive exec credential plugin (interactiveMode: Always), which cannot run non-interactively'

    public static readonly UnsupportedAuthProviderReason: string =
        'only the oidc auth-provider is supported; configure an exec credential plugin instead'

    public static readonly values: Record<TKubeconfigAuthType, string> = {
        clientCertificate: 'Client certificate',
        token: 'Bearer token',
        basic: 'User name and password',
        exec: 'Exec credential plugin',
        authProvider: 'Auth provider plugin',
        none: 'No credentials',
    }

    private static readonly reasons: Partial<Record<TKubeconfigAuthType, string>> = {}

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

    public static unsupportedReasonFor(
        type: TKubeconfigAuthType,
        execConfig?: TKubeconfigExecConfig,
        authProvider?: TKubeconfigAuthProvider,
    ): string {
        if (type === 'exec') {
            return execConfig?.interactiveMode === KubeconfigAuthTypeCatalog.InteractiveExecMode
                ? KubeconfigAuthTypeCatalog.InteractiveExecReason
                : ''
        }

        if (type === 'authProvider') {
            if (authProvider?.name === KubeconfigAuthTypeCatalog.SupportedAuthProvider) {
                return ''
            }
            if (authProvider?.name) {
                return `this context uses the "${authProvider.name}" auth-provider plugin, which is not supported; only the oidc auth-provider is supported, or configure an exec credential plugin instead`
            }
            return KubeconfigAuthTypeCatalog.UnsupportedAuthProviderReason
        }

        return KubeconfigAuthTypeCatalog.reason(type)
    }
}
