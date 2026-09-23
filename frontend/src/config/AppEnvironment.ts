const env: Record<string, any> = (import.meta as any).env

// Vite inlines these at build time — nothing here may be a secret.
export class AppEnvironment {
    public static readonly AppName: string = env.VITE_APP_NAME || 'kubiq'
    public static readonly DocsUrl: string = env.VITE_APP_DOCS_URL
    public static readonly Version: string = env.VITE_APP_VERSION || '0.0.0'
    public static readonly ReleaseRepository: string = env.VITE_APP_RELEASE_REPOSITORY || 'iappx/kubiq'
    public static readonly Dev = env.MODE == 'development'
}
