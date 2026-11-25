import { describe, expect, it } from 'vitest'
import { MetadataParser } from '@/domain/models/metadata'
import type { TMetadataParseContext } from '@/domain/models/metadata'
import { buildCertPem, textToBase64 } from '../../domain/certificate/x509Fixture'

const makeContext = (overrides: Partial<TMetadataParseContext> = {}): TMetadataParseContext => ({
    kind: 'annotation',
    namespace: 'prod',
    objectKind: 'Deployment',
    allLabels: {},
    allAnnotations: {},
    ...overrides,
})

describe('MetadataParser', () => {
    it('parses kubectl last-applied-configuration JSON as lastApplied and collapsed', () => {
        const manifest = {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: { name: 'api', namespace: 'prod' },
            spec: { replicas: 3 },
        }
        const raw = JSON.stringify(manifest)
        const entry = MetadataParser.parseEntry(
            'kubectl.kubernetes.io/last-applied-configuration',
            raw,
            makeContext(),
        )

        expect(entry.parsed).toEqual({
            kind: 'json',
            value: manifest,
            isArray: false,
            itemCount: 4,
            byteSize: new TextEncoder().encode(raw).length,
            isLastApplied: true,
        })
        expect(entry.collapsedByDefault).toBe(true)
        expect(entry.keyParts.isNoisy).toBe(true)
        expect(entry.base64Hint).toBeNull()
    })

    it('parses generic JSON objects and arrays with isLastApplied false', () => {
        const objectRaw = '{"retries":3,"timeout":"5s"}'
        const objectEntry = MetadataParser.parseEntry('custom.io/config', objectRaw, makeContext())

        expect(objectEntry.parsed).toEqual({
            kind: 'json',
            value: { retries: 3, timeout: '5s' },
            isArray: false,
            itemCount: 2,
            byteSize: objectRaw.length,
            isLastApplied: false,
        })
        expect(objectEntry.collapsedByDefault).toBe(true)

        const arrayRaw = '["a","b","c"]'
        const arrayEntry = MetadataParser.parseEntry('custom.io/items', arrayRaw, makeContext())

        expect(arrayEntry.parsed).toEqual({
            kind: 'json',
            value: ['a', 'b', 'c'],
            isArray: true,
            itemCount: 3,
            byteSize: arrayRaw.length,
            isLastApplied: false,
        })
        expect(arrayEntry.collapsedByDefault).toBe(true)

        const broken = MetadataParser.parseEntry('custom.io/bad', '{not-json}', makeContext())
        expect(broken.parsed).toEqual({ kind: 'plain', text: '{not-json}' })
    })

    it('parses ArgoCD tracking-id for grouped, core, and cluster-scoped resources', () => {
        const grouped = MetadataParser.parseEntry(
            'argocd.argoproj.io/tracking-id',
            'payments:apps/Deployment:prod/payments-api',
            makeContext(),
        )

        expect(grouped.parsed).toEqual({
            kind: 'structured',
            badge: 'ArgoCD tracking',
            summary: 'payments',
            fields: [
                {
                    label: 'Application',
                    value: 'payments',
                    mono: true,
                    reference: {
                        kindName: 'Application',
                        apiVersion: 'argoproj.io/v1alpha1',
                        name: 'payments',
                        namespace: '',
                        routeKind: 'argocd',
                    },
                },
                {
                    label: 'Group / Kind',
                    value: 'apps/Deployment',
                    mono: true,
                },
                {
                    label: 'Resource',
                    value: 'prod/payments-api',
                    mono: true,
                    reference: {
                        kindName: 'Deployment',
                        apiVersion: 'apps/',
                        name: 'payments-api',
                        namespace: 'prod',
                        routeKind: 'kube',
                    },
                },
            ],
        })

        const coreService = MetadataParser.parseEntry(
            'argocd.argoproj.io/tracking-id',
            'payments:Service:default/api',
            makeContext(),
        )

        expect(coreService.parsed).toMatchObject({
            kind: 'structured',
            badge: 'ArgoCD tracking',
            summary: 'payments',
            fields: [
                { label: 'Application', value: 'payments' },
                { label: 'Group / Kind', value: 'Service' },
                {
                    label: 'Resource',
                    value: 'default/api',
                    reference: {
                        kindName: 'Service',
                        apiVersion: 'v1',
                        name: 'api',
                        namespace: 'default',
                        routeKind: 'kube',
                    },
                },
            ],
        })

        const clusterScoped = MetadataParser.parseEntry(
            'argocd.argoproj.io/tracking-id',
            'platform:/Namespace:/prod',
            makeContext(),
        )

        expect(clusterScoped.parsed).toMatchObject({
            kind: 'structured',
            summary: 'platform',
            fields: [
                { label: 'Application', value: 'platform' },
                { label: 'Group / Kind', value: 'Namespace' },
                {
                    label: 'Resource',
                    value: 'prod',
                    reference: {
                        kindName: 'Namespace',
                        apiVersion: 'v1',
                        name: 'prod',
                        namespace: '',
                        routeKind: 'kube',
                    },
                },
            ],
        })
    })

    it('parses ArgoCD sync-options, compare-options, hook, and instance', () => {
        const syncOptions = MetadataParser.parseEntry(
            'argocd.argoproj.io/sync-options',
            'Prune=false, ServerSideApply=true, CreateNamespace',
            makeContext(),
        )

        expect(syncOptions.parsed).toEqual({
            kind: 'kvList',
            pairs: [
                { key: 'Prune', value: 'false' },
                { key: 'ServerSideApply', value: 'true' },
                { key: 'CreateNamespace', value: 'true' },
            ],
        })

        const compareOptions = MetadataParser.parseEntry(
            'argocd.argoproj.io/compare-options',
            'IgnoreExtraneous',
            makeContext(),
        )
        expect(compareOptions.parsed).toEqual({
            kind: 'kvList',
            pairs: [{ key: 'IgnoreExtraneous', value: 'true' }],
        })

        const hook = MetadataParser.parseEntry(
            'argocd.argoproj.io/hook',
            'PreSync, PostSync',
            makeContext(),
        )
        expect(hook.parsed).toEqual({
            kind: 'list',
            items: ['PreSync', 'PostSync'],
            separator: ',',
            itemKind: 'text',
        })

        const instance = MetadataParser.parseEntry(
            'argocd.argoproj.io/instance',
            'payments',
            makeContext({ kind: 'label' }),
        )
        expect(instance.parsed).toEqual({
            kind: 'reference',
            label: 'payments',
            target: {
                kindName: 'Application',
                apiVersion: 'argoproj.io/v1alpha1',
                name: 'payments',
                namespace: '',
                routeKind: 'argocd',
            },
        })
    })

    it('parses Kubernetes leader election and Multus network-status annotations', () => {
        const leaderRaw = JSON.stringify({
            holderIdentity: 'controller-0',
            leaseDurationSeconds: 15,
            acquireTime: '2026-06-01T10:00:00Z',
            renewTime: '2026-06-01T12:00:00Z',
            leaderTransitions: 2,
        })
        const leader = MetadataParser.parseEntry(
            'control-plane.alpha.kubernetes.io/leader',
            leaderRaw,
            makeContext(),
        )

        expect(leader.parsed).toEqual({
            kind: 'structured',
            badge: 'Leader election',
            summary: 'controller-0',
            fields: [
                { label: 'Holder', value: 'controller-0', mono: true },
                { label: 'Lease duration', value: '15s', mono: true },
                { label: 'Acquire time', value: '2026-06-01T10:00:00Z', mono: true },
                { label: 'Renew time', value: '2026-06-01T12:00:00Z', mono: true },
                { label: 'Transitions', value: '2', mono: true },
            ],
        })
        expect(leader.collapsedByDefault).toBe(true)

        const networkRaw = JSON.stringify([
            { name: 'cbr0', interface: 'eth0', ips: ['10.244.1.12'], default: true },
            { name: 'prod/vlan-10', interface: 'net1', ips: ['192.168.10.5', '192.168.10.6'] },
        ])
        const network = MetadataParser.parseEntry(
            'k8s.v1.cni.cncf.io/network-status',
            networkRaw,
            makeContext(),
        )

        expect(network.parsed).toEqual({
            kind: 'structured',
            badge: 'Network status',
            summary: '2 interfaces',
            fields: [
                { label: 'eth0 (cbr0)', value: '10.244.1.12 (default)', mono: true, tone: 'ok' },
                { label: 'net1 (prod/vlan-10)', value: '192.168.10.5, 192.168.10.6', mono: true },
            ],
        })
    })

    it('parses Kubernetes semantic references, lists, security profiles, and default class booleans', () => {
        const sa = MetadataParser.parseEntry('kubernetes.io/service-account.name', 'api-bot', makeContext())
        expect(sa.parsed).toEqual({
            kind: 'reference',
            label: 'api-bot',
            target: {
                kindName: 'ServiceAccount',
                apiVersion: 'v1',
                name: 'api-bot',
                namespace: 'prod',
                routeKind: 'kube',
            },
        })

        const helm = MetadataParser.parseEntry(
            'meta.helm.sh/release-name',
            'billing',
            makeContext({ allAnnotations: { 'meta.helm.sh/release-namespace': 'billing-ns' } }),
        )
        expect(helm.parsed).toEqual({
            kind: 'reference',
            label: 'billing',
            target: {
                kindName: 'HelmRelease',
                apiVersion: '',
                name: 'billing',
                namespace: 'billing-ns',
                routeKind: 'helm',
            },
        })

        const clusterIssuer = MetadataParser.parseEntry('cert-manager.io/cluster-issuer', 'letsencrypt-prod', makeContext())
        expect(clusterIssuer.parsed).toEqual({
            kind: 'reference',
            label: 'letsencrypt-prod',
            target: {
                kindName: 'ClusterIssuer',
                apiVersion: 'cert-manager.io/v1',
                name: 'letsencrypt-prod',
                namespace: '',
                routeKind: 'kube',
            },
        })

        const issuer = MetadataParser.parseEntry('cert-manager.io/issuer-name', 'internal-ca', makeContext())
        expect(issuer.parsed).toEqual({
            kind: 'reference',
            label: 'internal-ca',
            target: {
                kindName: 'Issuer',
                apiVersion: 'cert-manager.io/v1',
                name: 'internal-ca',
                namespace: 'prod',
                routeKind: 'kube',
            },
        })

        const issuerOverride = MetadataParser.parseEntry(
            'cert-manager.io/issuer',
            'vault-cluster',
            makeContext({ allAnnotations: { 'cert-manager.io/issuer-kind': 'ClusterIssuer' } }),
        )
        expect(issuerOverride.parsed).toEqual({
            kind: 'reference',
            label: 'vault-cluster',
            target: {
                kindName: 'ClusterIssuer',
                apiVersion: 'cert-manager.io/v1',
                name: 'vault-cluster',
                namespace: '',
                routeKind: 'kube',
            },
        })

        const ingressClass = MetadataParser.parseEntry('kubernetes.io/ingress.class', 'nginx', makeContext())
        expect(ingressClass.parsed).toEqual({
            kind: 'reference',
            label: 'nginx',
            target: {
                kindName: 'IngressClass',
                apiVersion: 'networking.k8s.io/v1',
                name: 'nginx',
                namespace: '',
                routeKind: 'kube',
            },
        })

        const storageClass = MetadataParser.parseEntry('volume.beta.kubernetes.io/storage-class', 'gp3', makeContext())
        expect(storageClass.parsed).toEqual({
            kind: 'reference',
            label: 'gp3',
            target: {
                kindName: 'StorageClass',
                apiVersion: 'storage.k8s.io/v1',
                name: 'gp3',
                namespace: '',
                routeKind: 'kube',
            },
        })

        const altNames = MetadataParser.parseEntry('cert-manager.io/alt-names', 'a.example.com, b.example.com', makeContext())
        expect(altNames.parsed).toEqual({
            kind: 'list',
            items: ['a.example.com', 'b.example.com'],
            separator: ',',
            itemKind: 'domain',
        })

        const helmHook = MetadataParser.parseEntry('helm.sh/hook', 'pre-install,pre-upgrade', makeContext())
        expect(helmHook.parsed).toEqual({
            kind: 'list',
            items: ['pre-install', 'pre-upgrade'],
            separator: ',',
            itemKind: 'text',
        })

        const seccomp = MetadataParser.parseEntry(
            'seccomp.security.alpha.kubernetes.io/pod',
            'localhost/profiles/audit.json',
            makeContext(),
        )
        expect(seccomp.parsed).toEqual({
            kind: 'structured',
            badge: 'Security profile',
            summary: 'localhost/profiles/audit.json',
            fields: [
                { label: 'Type', value: 'localhost', mono: true },
                { label: 'Profile', value: 'profiles/audit.json', mono: true },
            ],
        })

        const isDefault = MetadataParser.parseEntry('storageclass.kubernetes.io/is-default-class', 'true', makeContext())
        expect(isDefault.parsed).toEqual({ kind: 'boolean', value: true })
    })

    it('parses semantic and generic CIDR lists while rejecting invalid inputs', () => {
        const semantic = MetadataParser.parseEntry(
            'nginx.ingress.kubernetes.io/whitelist-source-range',
            '10.0.0.0/8',
            makeContext(),
        )
        expect(semantic.parsed).toEqual({
            kind: 'list',
            items: ['10.0.0.0/8'],
            separator: ',',
            itemKind: 'cidr',
        })

        const generic = MetadataParser.parseEntry(
            'custom.io/allowed-ips',
            '10.0.0.0/8, 192.168.1.1, 2001:db8::/32, ::1',
            makeContext(),
        )
        expect(generic.parsed).toEqual({
            kind: 'list',
            items: ['10.0.0.0/8', '192.168.1.1', '2001:db8::/32', '::1'],
            separator: ',',
            itemKind: 'cidr',
        })

        const invalidPrefix = MetadataParser.parseEntry('custom.io/bad-cidrs', '10.0.0.0/33, 192.168.1.1', makeContext())
        expect(invalidPrefix.parsed).toEqual({ kind: 'plain', text: '10.0.0.0/33, 192.168.1.1' })

        const singleCidr = MetadataParser.parseEntry('custom.io/single', '10.0.0.0/8', makeContext())
        expect(singleCidr.parsed).toEqual({ kind: 'plain', text: '10.0.0.0/8' })
    })

    it('parses multiline nginx, yaml, ini, and plain text snippets with collapse thresholds', () => {
        const nginxSnippet = 'proxy_set_header X-Forwarded-Proto $scheme;\nadd_header X-Frame-Options DENY;\nreturn 301 https://$host$request_uri;\nproxy_pass http://backend;'
        const nginx = MetadataParser.parseEntry(
            'nginx.ingress.kubernetes.io/configuration-snippet',
            nginxSnippet,
            makeContext(),
        )
        expect(nginx.parsed).toMatchObject({
            kind: 'multiline',
            lineCount: 4,
            syntaxHint: 'nginx',
        })
        expect(nginx.collapsedByDefault).toBe(true)

        const yamlText = 'timeout: 30s\nretries: 3\nbackoff: exponential'
        const yamlEntry = MetadataParser.parseEntry('custom.io/policy', yamlText, makeContext())
        expect(yamlEntry.parsed).toMatchObject({
            kind: 'multiline',
            lineCount: 3,
            syntaxHint: 'yaml',
        })
        expect(yamlEntry.collapsedByDefault).toBe(false)

        const iniText = '[database]\nhost = db.internal\nport = 5432'
        const iniEntry = MetadataParser.parseEntry('custom.io/db', iniText, makeContext())
        expect(iniEntry.parsed).toMatchObject({
            kind: 'multiline',
            lineCount: 3,
            syntaxHint: 'ini',
        })

        const plainMultiline = 'Deployed by CI pipeline\nCommit abc1234'
        const textEntry = MetadataParser.parseEntry('custom.io/notes', plainMultiline, makeContext())
        expect(textEntry.parsed).toMatchObject({
            kind: 'multiline',
            lineCount: 2,
            syntaxHint: 'text',
        })
        expect(textEntry.collapsedByDefault).toBe(false)
    })

    it('parses RFC3339 timestamps, URLs, and booleans accurately', () => {
        const tsUtc = MetadataParser.parseEntry(
            'kubectl.kubernetes.io/restartedAt',
            '2026-06-01T12:30:45.123Z',
            makeContext(),
        )
        expect(tsUtc.parsed).toEqual({
            kind: 'timestamp',
            iso: '2026-06-01T12:30:45.123Z',
            epochMs: Date.parse('2026-06-01T12:30:45.123Z'),
        })

        const tsOffset = MetadataParser.parseEntry(
            'custom.io/updated',
            '2026-06-01T14:30:00+02:00',
            makeContext(),
        )
        expect(tsOffset.parsed).toEqual({
            kind: 'timestamp',
            iso: '2026-06-01T14:30:00+02:00',
            epochMs: Date.parse('2026-06-01T14:30:00+02:00'),
        })

        const invalidDate = MetadataParser.parseEntry('custom.io/bad-date', '2026-02-30T00:00:00Z', makeContext())
        expect(invalidDate.parsed).toEqual({ kind: 'plain', text: '2026-02-30T00:00:00Z' })

        const httpsUrl = MetadataParser.parseEntry('custom.io/docs', 'https://kubiq.dev/docs/guide', makeContext())
        expect(httpsUrl.parsed).toEqual({
            kind: 'url',
            href: 'https://kubiq.dev/docs/guide',
            protocol: 'https:',
            clickable: true,
        })

        const ociUrl = MetadataParser.parseEntry('custom.io/chart', 'oci://ghcr.io/org/charts/app', makeContext())
        expect(ociUrl.parsed).toEqual({
            kind: 'url',
            href: 'oci://ghcr.io/org/charts/app',
            protocol: 'oci:',
            clickable: false,
        })

        const urlWithSpace = MetadataParser.parseEntry('custom.io/not-url', 'https://example.com hello', makeContext())
        expect(urlWithSpace.parsed).toEqual({ kind: 'plain', text: 'https://example.com hello' })

        const boolTrue = MetadataParser.parseEntry('prometheus.io/scrape', 'TRUE', makeContext())
        expect(boolTrue.parsed).toEqual({ kind: 'boolean', value: true })

        const boolFalse = MetadataParser.parseEntry('custom.io/enabled', 'false', makeContext())
        expect(boolFalse.parsed).toEqual({ kind: 'boolean', value: false })
    })

    it('parses PEM X.509 certificates and marks them collapsed by default', () => {
        const pem = buildCertPem({
            subject: [['2.5.4.3', 'webhook.prod.svc']],
            issuer: [['2.5.4.3', 'Cluster CA']],
            notBefore: '2026-01-01T00:00:00.000Z',
            notAfter: '2028-01-01T00:00:00.000Z',
        })
        const entry = MetadataParser.parseEntry('custom.io/ca-bundle', pem, makeContext())

        expect(entry.parsed.kind).toBe('certificate')
        if (entry.parsed.kind === 'certificate') {
            expect(entry.parsed.chain.certificates).toHaveLength(1)
            expect(entry.parsed.chain.certificates[0].subject).toBe('CN=webhook.prod.svc')
        }
        expect(entry.collapsedByDefault).toBe(true)
        expect(entry.base64Hint).toBeNull()
    })

    it('detects base64 hints only on plain values and collapses long plain values', () => {
        const encodedJson = textToBase64('{"env":"prod","replicas":3}')
        const b64Entry = MetadataParser.parseEntry('custom.io/blob', encodedJson, makeContext())

        expect(b64Entry.parsed).toEqual({ kind: 'plain', text: encodedJson })
        expect(b64Entry.base64Hint).toEqual({
            decoded: '{"env":"prod","replicas":3}',
            isJson: true,
            parsedJson: { env: 'prod', replicas: 3 },
            byteSize: 27,
        })

        const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        const checksum = MetadataParser.parseEntry('checksum/config', sha256, makeContext())
        expect(checksum.parsed).toEqual({ kind: 'plain', text: sha256 })
        expect(checksum.base64Hint).toBeNull()
        expect(checksum.collapsedByDefault).toBe(true)

        const longPlain = 'x'.repeat(201)
        const longEntry = MetadataParser.parseEntry('custom.io/long', longPlain, makeContext())
        expect(longEntry.parsed).toEqual({ kind: 'plain', text: longPlain })
        expect(longEntry.collapsedByDefault).toBe(true)

        const shortPlain = 'v1.4.2'
        const shortEntry = MetadataParser.parseEntry('app.kubernetes.io/version', shortPlain, makeContext({ kind: 'label' }))
        expect(shortEntry.parsed).toEqual({ kind: 'plain', text: shortPlain })
        expect(shortEntry.collapsedByDefault).toBe(false)
    })

    it('parses a metadata map sorted alphabetically by key', () => {
        const entries = MetadataParser.parseMap(
            {
                'z.io/flag': 'true',
                'a.io/name': 'orders',
                'm.io/site': 'https://orders.internal',
            },
            makeContext(),
        )

        expect(entries.map(entry => entry.key)).toEqual(['a.io/name', 'm.io/site', 'z.io/flag'])
        expect(entries.map(entry => entry.parsed.kind)).toEqual(['plain', 'url', 'boolean'])
    })

    it('parses Rancher field.cattle.io/publicEndpoints with clickable URLs and resource references', () => {
        const raw = JSON.stringify([
            {
                addresses: ['192.168.1.10'],
                port: 443,
                protocol: 'HTTPS',
                serviceName: 'prod:api-svc',
                ingressName: 'prod:api-ing',
                hostname: 'api.example.com',
                path: '/v1',
                allNodes: false,
            },
            {
                addresses: ['10.0.0.5', '10.0.0.6'],
                port: 30443,
                protocol: 'TCP',
                serviceName: 'prod:db-svc',
                allNodes: true,
            },
        ])

        const entry = MetadataParser.parseEntry('field.cattle.io/publicEndpoints', raw, makeContext())

        expect(entry.keyParts.domainGroup).toBe('cattle.io')
        expect(entry.description).toContain('Rancher')
        expect(entry.parsed).toEqual({
            kind: 'structured',
            badge: 'Public endpoints',
            summary: '2 endpoints',
            fields: [
                {
                    label: '#1 Endpoint',
                    value: 'https://api.example.com/v1',
                    mono: true,
                    url: 'https://api.example.com/v1',
                },
                {
                    label: '#1 Addresses',
                    value: '192.168.1.10',
                    mono: true,
                },
                {
                    label: '#1 Ingress',
                    value: 'prod:api-ing',
                    mono: true,
                    reference: {
                        kindName: 'Ingress',
                        apiVersion: 'networking.k8s.io/v1',
                        name: 'api-ing',
                        namespace: 'prod',
                        routeKind: 'kube',
                    },
                },
                {
                    label: '#1 Service',
                    value: 'prod:api-svc',
                    mono: true,
                    reference: {
                        kindName: 'Service',
                        apiVersion: 'v1',
                        name: 'api-svc',
                        namespace: 'prod',
                        routeKind: 'kube',
                    },
                },
                {
                    label: '#2 Endpoint',
                    value: '10.0.0.5:30443, 10.0.0.6:30443 (TCP)',
                    mono: true,
                },
                {
                    label: '#2 Service',
                    value: 'prod:db-svc',
                    mono: true,
                    reference: {
                        kindName: 'Service',
                        apiVersion: 'v1',
                        name: 'db-svc',
                        namespace: 'prod',
                        routeKind: 'kube',
                    },
                },
                {
                    label: '#2 Scope',
                    value: 'All nodes',
                    tone: 'info',
                },
            ],
        })

        const singleRaw = JSON.stringify([
            {
                addresses: ['10.0.0.8'],
                port: 8080,
                protocol: 'HTTP',
                serviceName: 'web',
            },
        ])
        const single = MetadataParser.parseEntry('field.cattle.io/publicEndpoints', singleRaw, makeContext())
        expect(single.parsed).toEqual({
            kind: 'structured',
            badge: 'Public endpoints',
            summary: 'http://10.0.0.8:8080',
            fields: [
                {
                    label: 'Endpoint',
                    value: 'http://10.0.0.8:8080',
                    mono: true,
                    url: 'http://10.0.0.8:8080',
                },
                {
                    label: 'Service',
                    value: 'web',
                    mono: true,
                    reference: {
                        kindName: 'Service',
                        apiVersion: 'v1',
                        name: 'web',
                        namespace: 'prod',
                        routeKind: 'kube',
                    },
                },
            ],
        })
    })
})
