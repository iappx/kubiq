import { describe, expect, it } from 'vitest'
import { LastAppliedDiff } from '@/application/services/resourceYaml/models/LastAppliedDiff'
import { DetailFacts } from '@/components/resource/detail/DetailFacts'
import { KubeManifest } from '@/domain/models/kube'
import {
    MetadataKeyAnalyzer,
    MetadataOwnershipExtractor,
    MetadataParser,
} from '@/domain/models/metadata'
import { buildCertPem, textToBase64 } from '../../domain/certificate/x509Fixture'

const futureIso = (days: number): string => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

describe('Metadata parser integration on Kubernetes manifests', () => {
    it('parses, groups, filters, extracts ownership, and diffs last-applied configuration on a Deployment', () => {
        const appliedManifest = {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: {
                name: 'payments-api',
                namespace: 'payments',
                labels: {
                    'app.kubernetes.io/name': 'payments',
                    'app.kubernetes.io/version': '1.4.2',
                },
            },
            spec: {
                replicas: 3,
                selector: { matchLabels: { app: 'payments' } },
            },
        }

        const deployment: Record<string, unknown> = {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: {
                name: 'payments-api',
                namespace: 'payments',
                uid: 'dep-uid-1',
                resourceVersion: '99812',
                generation: 4,
                creationTimestamp: '2026-09-20T08:00:00Z',
                managedFields: [{ manager: 'kubectl-client-side-apply', operation: 'Update' }],
                labels: {
                    'app.kubernetes.io/name': 'payments',
                    'app.kubernetes.io/instance': 'payments-prod',
                    'app.kubernetes.io/version': '1.4.2',
                    'app.kubernetes.io/managed-by': 'Helm',
                    'app.kubernetes.io/part-of': 'checkout',
                    'helm.sh/chart': 'payments-1.4.2',
                    'argocd.argoproj.io/instance': 'payments-app',
                    tier: 'backend',
                },
                annotations: {
                    'meta.helm.sh/release-name': 'payments-prod',
                    'meta.helm.sh/release-namespace': 'payments',
                    'argocd.argoproj.io/tracking-id': 'payments-app:apps/Deployment:payments/payments-api',
                    'argocd.argoproj.io/sync-options': 'Prune=false,CreateNamespace=true',
                    'kubectl.kubernetes.io/restartedAt': '2026-09-21T10:15:30Z',
                    'kubectl.kubernetes.io/last-applied-configuration': JSON.stringify(appliedManifest),
                    'checksum/config': 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
                    'deployment.kubernetes.io/revision': '7',
                    'team.example.com/runbook': 'https://docs.example.com/payments/runbook',
                },
            },
            spec: {
                replicas: 5,
                selector: { matchLabels: { app: 'payments' } },
            },
            status: {
                readyReplicas: 5,
                availableReplicas: 5,
            },
        }

        const labels = DetailFacts.labelsOf(deployment)
        const annotations = DetailFacts.annotationsOf(deployment)
        const namespace = KubeManifest.namespaceOf(deployment)
        const objectKind = KubeManifest.kindOf(deployment)

        const labelEntries = MetadataParser.parseMap(labels, {
            kind: 'label',
            namespace,
            objectKind,
            allLabels: labels,
            allAnnotations: annotations,
        })
        const annotationEntries = MetadataParser.parseMap(annotations, {
            kind: 'annotation',
            namespace,
            objectKind,
            allLabels: labels,
            allAnnotations: annotations,
        })

        const byAnnotation = (key: string) => annotationEntries.find(item => item.key === key)!
        const byLabel = (key: string) => labelEntries.find(item => item.key === key)!

        expect(byLabel('argocd.argoproj.io/instance').parsed).toMatchObject({
            kind: 'reference',
            label: 'payments-app',
            target: { kindName: 'Application', routeKind: 'argocd', name: 'payments-app' },
        })
        expect(byLabel('tier').keyParts.domainGroup).toBe(MetadataKeyAnalyzer.customGroup)

        expect(byAnnotation('meta.helm.sh/release-name').parsed).toMatchObject({
            kind: 'reference',
            label: 'payments-prod',
            target: { routeKind: 'helm', name: 'payments-prod', namespace: 'payments' },
        })
        expect(byAnnotation('argocd.argoproj.io/tracking-id').parsed).toMatchObject({
            kind: 'structured',
            badge: 'ArgoCD tracking',
            summary: 'payments-app',
        })
        expect(byAnnotation('argocd.argoproj.io/sync-options').parsed).toEqual({
            kind: 'kvList',
            pairs: [
                { key: 'Prune', value: 'false' },
                { key: 'CreateNamespace', value: 'true' },
            ],
        })
        expect(byAnnotation('kubectl.kubernetes.io/restartedAt').parsed).toMatchObject({
            kind: 'timestamp',
            iso: '2026-09-21T10:15:30Z',
        })
        expect(byAnnotation('team.example.com/runbook').parsed).toMatchObject({
            kind: 'url',
            href: 'https://docs.example.com/payments/runbook',
            clickable: true,
        })

        const lastAppliedEntry = byAnnotation('kubectl.kubernetes.io/last-applied-configuration')
        expect(lastAppliedEntry.parsed.kind).toBe('json')
        if (lastAppliedEntry.parsed.kind === 'json') {
            expect(lastAppliedEntry.parsed.isLastApplied).toBe(true)
            const diff = LastAppliedDiff.compare(lastAppliedEntry.parsed.value, deployment)
            expect(diff).not.toBeNull()
            expect(diff!.hasChanges).toBe(true)
            expect(diff!.currentYaml).not.toContain('managedFields')
            expect(diff!.currentYaml).not.toContain('resourceVersion')
            expect(diff!.currentYaml).not.toContain('dep-uid-1')
            expect(diff!.currentYaml).not.toContain('readyReplicas')
            expect(diff!.lines.some(line => line.text.includes('replicas: 5'))).toBe(true)
            expect(diff!.lines.some(line => line.text.includes('replicas: 3'))).toBe(true)

            const alignedObject: Record<string, unknown> = {
                spec: { selector: { matchLabels: { app: 'payments' } }, replicas: 3 },
                kind: 'Deployment',
                apiVersion: 'apps/v1',
                metadata: {
                    namespace: 'payments',
                    name: 'payments-api',
                    uid: 'dep-uid-2',
                    resourceVersion: '99999',
                    creationTimestamp: '2026-09-20T08:00:00Z',
                    labels: {
                        'app.kubernetes.io/version': '1.4.2',
                        'app.kubernetes.io/name': 'payments',
                    },
                    annotations: {
                        'kubectl.kubernetes.io/last-applied-configuration': JSON.stringify(appliedManifest),
                    },
                },
                status: { readyReplicas: 3 },
            }
            const cleanDiff = LastAppliedDiff.compare(lastAppliedEntry.parsed.value, alignedObject)
            expect(cleanDiff).not.toBeNull()
            expect(cleanDiff!.hasChanges).toBe(false)
        }
        expect(lastAppliedEntry.collapsedByDefault).toBe(true)
        expect(lastAppliedEntry.keyParts.isNoisy).toBe(true)

        const annotationGroups = MetadataKeyAnalyzer.group(annotationEntries)
        const lastGroup = annotationGroups[annotationGroups.length - 1]
        expect(lastGroup.id).toBe('system-generated')
        expect(lastGroup.isNoisy).toBe(true)
        expect(lastGroup.entries.map(item => item.key)).toEqual([
            'checksum/config',
            'kubectl.kubernetes.io/last-applied-configuration',
        ])

        const labelGroups = MetadataKeyAnalyzer.group(labelEntries)
        expect(labelGroups[labelGroups.length - 1].title).toBe(MetadataKeyAnalyzer.customGroup)

        expect(MetadataKeyAnalyzer.filter(annotationEntries, 'ArgoCD tracking').map(item => item.key))
            .toEqual(['argocd.argoproj.io/tracking-id'])
        expect(MetadataKeyAnalyzer.filter(annotationEntries, 'runbook').map(item => item.key))
            .toEqual(['team.example.com/runbook'])
        expect(MetadataKeyAnalyzer.filter(annotationEntries, 'nonexistent-needle')).toEqual([])

        const badges = MetadataOwnershipExtractor.extract(labels, annotations, namespace)
        expect(badges.map(badge => badge.provider)).toEqual(['helm', 'argocd', 'k8s-app'])
        expect(badges.find(badge => badge.provider === 'helm')?.reference?.routeKind).toBe('helm')
        expect(badges.find(badge => badge.provider === 'argocd')?.reference?.routeKind).toBe('argocd')
    })

    it('parses cert-manager, nginx multiline snippets, CIDR/domain lists, and ingress references', () => {
        const nginxSnippet = [
            'proxy_set_header X-Request-ID $req_id;',
            'proxy_read_timeout 120s;',
            'add_header X-Frame-Options "DENY";',
            'more_set_headers "X-Content-Type-Options: nosniff";',
        ].join('\n')

        const ingress: Record<string, unknown> = {
            apiVersion: 'networking.k8s.io/v1',
            kind: 'Ingress',
            metadata: {
                name: 'public-api',
                namespace: 'edge',
                annotations: {
                    'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
                    'cert-manager.io/alt-names': 'api.example.com, www.example.com',
                    'nginx.ingress.kubernetes.io/whitelist-source-range': '10.0.0.0/8, 192.168.1.0/24',
                    'nginx.ingress.kubernetes.io/configuration-snippet': nginxSnippet,
                    'kubernetes.io/ingress.class': 'nginx',
                    'ingressclass.kubernetes.io/is-default-class': 'true',
                },
            },
        }

        const annotations = DetailFacts.annotationsOf(ingress)
        const entries = MetadataParser.parseMap(annotations, {
            kind: 'annotation',
            namespace: 'edge',
            objectKind: 'Ingress',
            allLabels: {},
            allAnnotations: annotations,
        })
        const byKey = (key: string) => entries.find(item => item.key === key)!

        expect(byKey('cert-manager.io/cluster-issuer').parsed).toMatchObject({
            kind: 'reference',
            label: 'letsencrypt-prod',
            target: { kindName: 'ClusterIssuer', apiVersion: 'cert-manager.io/v1', name: 'letsencrypt-prod', routeKind: 'kube' },
        })
        expect(byKey('cert-manager.io/alt-names').parsed).toEqual({
            kind: 'list',
            items: ['api.example.com', 'www.example.com'],
            separator: ',',
            itemKind: 'domain',
        })
        expect(byKey('nginx.ingress.kubernetes.io/whitelist-source-range').parsed).toEqual({
            kind: 'list',
            items: ['10.0.0.0/8', '192.168.1.0/24'],
            separator: ',',
            itemKind: 'cidr',
        })
        expect(byKey('nginx.ingress.kubernetes.io/configuration-snippet').parsed).toMatchObject({
            kind: 'multiline',
            lineCount: 4,
            syntaxHint: 'nginx',
        })
        expect(byKey('nginx.ingress.kubernetes.io/configuration-snippet').collapsedByDefault).toBe(true)
        expect(byKey('kubernetes.io/ingress.class').parsed).toMatchObject({
            kind: 'reference',
            label: 'nginx',
            target: { kindName: 'IngressClass', name: 'nginx', routeKind: 'kube' },
        })
        expect(byKey('ingressclass.kubernetes.io/is-default-class').parsed).toEqual({
            kind: 'boolean',
            value: true,
        })

        const groupTitles = MetadataKeyAnalyzer.group(entries).map(group => group.title)
        expect(groupTitles).toEqual(['cert-manager.io', 'kubernetes.io', 'nginx.ingress.kubernetes.io'])
    })

    it('parses pod networking, security profiles, prometheus ownership, base64 hints, and embedded PEM certificates', () => {
        const certPem = buildCertPem({
            subject: [['2.5.4.3', 'workload.internal']],
            notBefore: futureIso(-5),
            notAfter: futureIso(60),
        })
        const encodedJson = textToBase64(JSON.stringify({ region: 'eu-west-1', canary: true }))
        const sha256Hex = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

        const pod: Record<string, unknown> = {
            apiVersion: 'v1',
            kind: 'Pod',
            metadata: {
                name: 'worker-0',
                namespace: 'payments',
                annotations: {
                    'prometheus.io/scrape': 'true',
                    'prometheus.io/port': '9090',
                    'prometheus.io/path': '/metrics',
                    'kubernetes.io/service-account.name': 'worker-sa',
                    'k8s.v1.cni.cncf.io/network-status': JSON.stringify([
                        { name: 'cilium', interface: 'eth0', ips: ['10.244.1.15'], default: true },
                    ]),
                    'seccomp.security.alpha.kubernetes.io/pod': 'runtime/default',
                    'custom.example.com/encoded-config': encodedJson,
                    'custom.example.com/commit-sha': sha256Hex,
                    'custom.example.com/mtls-cert': certPem,
                },
            },
        }

        const annotations = DetailFacts.annotationsOf(pod)
        const entries = MetadataParser.parseMap(annotations, {
            kind: 'annotation',
            namespace: 'payments',
            objectKind: 'Pod',
            allLabels: {},
            allAnnotations: annotations,
        })
        const byKey = (key: string) => entries.find(item => item.key === key)!

        expect(byKey('kubernetes.io/service-account.name').parsed).toMatchObject({
            kind: 'reference',
            label: 'worker-sa',
            target: { kindName: 'ServiceAccount', apiVersion: 'v1', name: 'worker-sa', namespace: 'payments', routeKind: 'kube' },
        })
        expect(byKey('k8s.v1.cni.cncf.io/network-status').parsed).toMatchObject({
            kind: 'structured',
            badge: 'Network status',
        })
        expect(byKey('k8s.v1.cni.cncf.io/network-status').keyParts.isNoisy).toBe(true)
        expect(byKey('seccomp.security.alpha.kubernetes.io/pod').parsed).toMatchObject({
            kind: 'structured',
            badge: 'Security profile',
        })

        const encodedEntry = byKey('custom.example.com/encoded-config')
        expect(encodedEntry.parsed.kind).toBe('plain')
        expect(encodedEntry.base64Hint).not.toBeNull()
        expect(encodedEntry.base64Hint?.isJson).toBe(true)
        expect(encodedEntry.base64Hint?.parsedJson).toEqual({ region: 'eu-west-1', canary: true })

        const shaEntry = byKey('custom.example.com/commit-sha')
        expect(shaEntry.parsed.kind).toBe('plain')
        expect(shaEntry.base64Hint).toBeNull()

        const certEntry = byKey('custom.example.com/mtls-cert')
        expect(certEntry.parsed.kind).toBe('certificate')
        expect(certEntry.collapsedByDefault).toBe(true)
        if (certEntry.parsed.kind === 'certificate') {
            expect(certEntry.parsed.chain.certificates).toHaveLength(1)
        }

        const badges = MetadataOwnershipExtractor.extract({}, annotations, 'payments')
        expect(badges).toHaveLength(1)
        expect(badges[0]).toMatchObject({
            provider: 'prometheus',
            detail: ':9090/metrics',
        })
    })
})
