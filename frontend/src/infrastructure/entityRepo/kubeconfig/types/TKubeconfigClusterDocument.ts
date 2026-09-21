export type TKubeconfigClusterDocument = {
    server?: string
    'certificate-authority'?: string
    'certificate-authority-data'?: string
    'insecure-skip-tls-verify'?: boolean
    'tls-server-name'?: string
    'proxy-url'?: string
}
