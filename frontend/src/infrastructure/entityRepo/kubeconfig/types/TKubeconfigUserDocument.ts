export type TKubeconfigUserDocument = {
    'client-certificate'?: string
    'client-certificate-data'?: string
    'client-key'?: string
    'client-key-data'?: string
    token?: string
    tokenFile?: string
    username?: string
    password?: string
    exec?: {
        apiVersion?: string
        command?: string
        args?: unknown[]
        env?: { name?: string; value?: unknown }[] | null
        installHint?: string
        interactiveMode?: string
        provideClusterInfo?: boolean
    }
    'auth-provider'?: {
        name?: string
        config?: Record<string, unknown>
    }
}
