export type TConnectionSpec = {
    server: string
    caPem: string
    clientCertPem: string
    clientKeyPem: string
    token: string
    username: string
    password: string
    insecureSkipTlsVerify: boolean
    serverName: string
    proxyUrl: string
    /** Seconds; 0 leaves the timeout to the Go client. */
    timeoutSeconds: number
}
