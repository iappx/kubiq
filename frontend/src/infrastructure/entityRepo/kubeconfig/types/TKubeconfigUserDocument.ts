export type TKubeconfigUserDocument = {
    'client-certificate'?: string
    'client-certificate-data'?: string
    'client-key'?: string
    'client-key-data'?: string
    token?: string
    tokenFile?: string
    username?: string
    password?: string
    exec?: { command?: string }
    'auth-provider'?: { name?: string }
}
