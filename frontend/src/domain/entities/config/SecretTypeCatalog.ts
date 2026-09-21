export class SecretTypeCatalog {
    public static readonly values: Record<string, string> = {
        'Opaque': 'Opaque',
        'kubernetes.io/service-account-token': 'Service account token',
        'kubernetes.io/dockercfg': 'Docker registry (dockercfg)',
        'kubernetes.io/dockerconfigjson': 'Docker registry',
        'kubernetes.io/basic-auth': 'Basic auth',
        'kubernetes.io/ssh-auth': 'SSH key',
        'kubernetes.io/tls': 'TLS certificate',
        'bootstrap.kubernetes.io/token': 'Bootstrap token',
    }

    public static title(type: string): string {
        return SecretTypeCatalog.values[type] ?? type
    }

    public static has(type: string): boolean {
        return Object.prototype.hasOwnProperty.call(SecretTypeCatalog.values, type)
    }
}
