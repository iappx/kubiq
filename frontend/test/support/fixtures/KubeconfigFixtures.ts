// Every value here is invented: the certificates are not certificates and the
// tokens are not tokens, so a failing assertion can print the whole fixture.
export class KubeconfigFixtures {
    public static readonly caPem = '-----BEGIN CERTIFICATE-----\nfake-ca-authority\n-----END CERTIFICATE-----\n'

    public static readonly clientCertPem = '-----BEGIN CERTIFICATE-----\nfake-client-certificate\n-----END CERTIFICATE-----\n'

    public static readonly clientKeyPem = '-----BEGIN RSA PRIVATE KEY-----\nfake-client-key\n-----END RSA PRIVATE KEY-----\n'

    public static readonly stagingToken = 'fake-staging-token'

    public static readonly sharedToken = 'fake-shared-token'

    public static readonly labPassword = 'fake-lab-password'

    public static b64(value: string): string {
        return btoa(value)
    }

    public static primary(): string {
        return [
            'apiVersion: v1',
            'kind: Config',
            'current-context: prod',
            'preferences: {}',
            'clusters:',
            '  - name: prod',
            '    cluster:',
            '      server: https://prod.example.internal:6443',
            `      certificate-authority-data: ${KubeconfigFixtures.b64(KubeconfigFixtures.caPem)}`,
            '  - name: staging',
            '    cluster:',
            '      server: https://staging.example.internal:6443',
            '      insecure-skip-tls-verify: true',
            '      tls-server-name: staging.internal',
            '      proxy-url: http://proxy.example.internal:3128',
            'contexts:',
            '  - name: prod',
            '    context:',
            '      cluster: prod',
            '      user: prod-admin',
            '      namespace: payments',
            '  - name: staging',
            '    context:',
            '      cluster: staging',
            '      user: staging-token',
            '  - name: shared',
            '    context:',
            '      cluster: shared',
            '      user: shared-token',
            '  - context:',
            '      cluster: prod',
            '      user: prod-admin',
            'users:',
            '  - name: prod-admin',
            '    user:',
            `      client-certificate-data: ${KubeconfigFixtures.b64(KubeconfigFixtures.clientCertPem)}`,
            `      client-key-data: ${KubeconfigFixtures.b64(KubeconfigFixtures.clientKeyPem)}`,
            '  - name: staging-token',
            '    user:',
            `      token: ${KubeconfigFixtures.stagingToken}`,
            '',
        ].join('\n')
    }

    public static secondary(): string {
        return [
            'apiVersion: v1',
            'kind: Config',
            'current-context: lab',
            'clusters:',
            '  - name: prod',
            '    cluster:',
            '      server: https://prod-duplicate.example.internal:6443',
            '  - name: shared',
            '    cluster:',
            '      server: https://shared.example.internal:6443',
            'contexts:',
            '  - name: prod',
            '    context:',
            '      cluster: prod',
            '      user: lab-basic',
            '      namespace: duplicate',
            '  - name: lab',
            '    context:',
            '      cluster: shared',
            '      user: lab-basic',
            'users:',
            '  - name: shared-token',
            '    user:',
            `      token: ${KubeconfigFixtures.sharedToken}`,
            '  - name: lab-basic',
            '    user:',
            '      username: lab',
            `      password: ${KubeconfigFixtures.labPassword}`,
            '',
        ].join('\n')
    }

    public static withoutCurrentContext(): string {
        return [
            'apiVersion: v1',
            'kind: Config',
            'current-context: ""',
            'clusters:',
            '  - name: edge',
            '    cluster:',
            '      server: https://edge.example.internal:6443',
            'contexts:',
            '  - name: edge',
            '    context:',
            '      cluster: edge',
            '      user: edge-token',
            'users:',
            '  - name: edge-token',
            '    user:',
            '      token: fake-edge-token',
            '',
        ].join('\n')
    }

    public static withFileReferences(): string {
        return [
            'apiVersion: v1',
            'kind: Config',
            'current-context: files',
            'clusters:',
            '  - name: files',
            '    cluster:',
            '      server: https://files.example.internal:6443',
            '      certificate-authority: pki/ca.pem',
            'contexts:',
            '  - name: files',
            '    context:',
            '      cluster: files',
            '      user: files-user',
            'users:',
            '  - name: files-user',
            '    user:',
            '      client-certificate: pki/client.crt',
            '      client-key: /etc/kubiq/client.key',
            '      tokenFile: pki/token',
            '',
        ].join('\n')
    }

    public static withPlugins(): string {
        return [
            'apiVersion: v1',
            'kind: Config',
            'current-context: oidc',
            'clusters:',
            '  - name: plugins',
            '    cluster:',
            '      server: https://plugins.example.internal:6443',
            'contexts:',
            '  - name: exec',
            '    context:',
            '      cluster: plugins',
            '      user: exec-user',
            '  - name: oidc',
            '    context:',
            '      cluster: plugins',
            '      user: oidc-user',
            'users:',
            '  - name: exec-user',
            '    user:',
            '      exec:',
            '        apiVersion: client.authentication.k8s.io/v1beta1',
            '        command: aws',
            '  - name: oidc-user',
            '    user:',
            '      auth-provider:',
            '        name: oidc',
            '',
        ].join('\n')
    }

    public static broken(): string {
        return [
            'apiVersion: v1',
            'clusters:',
            '  - name: broken',
            '    cluster:',
            '  server: https://broken.example.internal:6443',
            'users:',
            '  - name: broken',
            '    user:',
            '      token: fake-broken-token',
            '',
        ].join('\n')
    }
}
