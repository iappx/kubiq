import { describe, expect, it } from 'vitest'
import { MetadataKeyAnalyzer } from '@/domain/models/metadata/MetadataKeyAnalyzer'
import { MetadataKeyCatalog } from '@/domain/models/metadata/MetadataKeyCatalog'
import type { TMetadataEntry } from '@/domain/models/metadata/types/TMetadataEntry'
import type { TMetadataParsedValue } from '@/domain/models/metadata/types/TMetadataParsedValue'

const buildEntry = (
    key: string,
    rawValue: string,
    parsed: TMetadataParsedValue = { kind: 'plain', text: rawValue }
): TMetadataEntry => ({
    key,
    rawValue,
    keyParts: MetadataKeyAnalyzer.split(key),
    parsed,
    collapsedByDefault: false,
    description: MetadataKeyCatalog.describe(key),
    base64Hint: null,
})

describe('MetadataKeyAnalyzer', () => {
    describe('split', () => {
        it('splits keys without a prefix into the Custom domain group', () => {
            expect(MetadataKeyAnalyzer.split('app')).toEqual({
                raw: 'app',
                prefix: '',
                name: 'app',
                domainGroup: 'Custom',
                isNoisy: false,
            })
        })

        it('normalizes well-known Kubernetes and ecosystem prefixes', () => {
            expect(MetadataKeyAnalyzer.split('app.kubernetes.io/name')).toMatchObject({
                prefix: 'app.kubernetes.io',
                name: 'name',
                domainGroup: 'kubernetes.io',
                isNoisy: false,
            })
            expect(MetadataKeyAnalyzer.split('kubernetes.io/hostname').domainGroup).toBe('kubernetes.io')
            expect(MetadataKeyAnalyzer.split('sigs.k8s.io/aws-load-balancer').domainGroup).toBe('kubernetes.io')
            expect(MetadataKeyAnalyzer.split('k8s.io/role').domainGroup).toBe('kubernetes.io')
            expect(MetadataKeyAnalyzer.split('nginx.ingress.kubernetes.io/rewrite-target').domainGroup).toBe(
                'nginx.ingress.kubernetes.io'
            )
            expect(MetadataKeyAnalyzer.split('argocd.argoproj.io/tracking-id').domainGroup).toBe('argoproj.io')
            expect(MetadataKeyAnalyzer.split('meta.helm.sh/release-name').domainGroup).toBe('helm.sh')
            expect(MetadataKeyAnalyzer.split('helm.sh/chart').domainGroup).toBe('helm.sh')
            expect(MetadataKeyAnalyzer.split('cert-manager.io/cluster-issuer').domainGroup).toBe('cert-manager.io')
            expect(MetadataKeyAnalyzer.split('acme.cert-manager.io/http01-edit-in-place').domainGroup).toBe(
                'cert-manager.io'
            )
            expect(MetadataKeyAnalyzer.split('prometheus.io/scrape').domainGroup).toBe('prometheus.io')
            expect(MetadataKeyAnalyzer.split('custom.example.com/tier').domainGroup).toBe('custom.example.com')
        })

        it('marks exact noisy keys and noisy prefixes', () => {
            expect(MetadataKeyAnalyzer.split('kubectl.kubernetes.io/last-applied-configuration').isNoisy).toBe(true)
            expect(MetadataKeyAnalyzer.split('kubernetes.io/config.hash').isNoisy).toBe(true)
            expect(MetadataKeyAnalyzer.split('control-plane.alpha.kubernetes.io/leader').isNoisy).toBe(true)
            expect(MetadataKeyAnalyzer.split('checksum/config').isNoisy).toBe(true)
            expect(MetadataKeyAnalyzer.split('cni.projectcalico.org/podIP').isNoisy).toBe(true)
            expect(MetadataKeyAnalyzer.split('k8s.v1.cni.cncf.io/network-status').isNoisy).toBe(true)
            expect(MetadataKeyAnalyzer.split('app.kubernetes.io/part-of').isNoisy).toBe(false)
        })
    })

    describe('group', () => {
        it('sorts domain groups alphabetically with Custom before System / Generated', () => {
            const entries: TMetadataEntry[] = [
                buildEntry('env', 'prod'),
                buildEntry('checksum/config', 'abc123'),
                buildEntry('prometheus.io/scrape', 'true'),
                buildEntry('app.kubernetes.io/name', 'payments'),
                buildEntry('argocd.argoproj.io/instance', 'payments-app'),
                buildEntry('kubectl.kubernetes.io/last-applied-configuration', '{}'),
            ]

            const groups = MetadataKeyAnalyzer.group(entries)

            expect(groups.map((group) => group.title)).toEqual([
                'argoproj.io',
                'kubernetes.io',
                'prometheus.io',
                'Custom',
                'System / Generated',
            ])
            expect(groups[4].id).toBe('system-generated')
            expect(groups[4].isNoisy).toBe(true)
            expect(groups[4].entries.map((entry) => entry.key)).toEqual([
                'checksum/config',
                'kubectl.kubernetes.io/last-applied-configuration',
            ])
            expect(groups.slice(0, 4).every((group) => !group.isNoisy)).toBe(true)
        })

        it('omits System / Generated when there are no noisy entries', () => {
            const groups = MetadataKeyAnalyzer.group([
                buildEntry('app', 'web'),
                buildEntry('meta.helm.sh/release-name', 'web-release'),
            ])

            expect(groups.map((group) => group.title)).toEqual(['helm.sh', 'Custom'])
        })
    })

    describe('filter', () => {
        const entries: TMetadataEntry[] = [
            buildEntry('app.kubernetes.io/name', 'payments'),
            buildEntry('prometheus.io/scrape', 'true'),
            buildEntry('argocd.argoproj.io/tracking-id', 'billing:apps/Deployment:prod/api', {
                kind: 'structured',
                badge: 'ArgoCD tracking',
                summary: 'billing',
                fields: [],
            }),
        ]

        it('returns all entries when the query is blank', () => {
            expect(MetadataKeyAnalyzer.filter(entries, '   ')).toHaveLength(3)
        })

        it('matches case-insensitively across key, value, description, and structured badge or summary', () => {
            expect(MetadataKeyAnalyzer.filter(entries, 'PAYMENTS').map((e) => e.key)).toEqual([
                'app.kubernetes.io/name',
            ])
            expect(MetadataKeyAnalyzer.filter(entries, 'metrics scraping').map((e) => e.key)).toEqual([
                'prometheus.io/scrape',
            ])
            expect(MetadataKeyAnalyzer.filter(entries, 'argocd tracking').map((e) => e.key)).toEqual([
                'argocd.argoproj.io/tracking-id',
            ])
            expect(MetadataKeyAnalyzer.filter(entries, 'BILLING').map((e) => e.key)).toEqual([
                'argocd.argoproj.io/tracking-id',
            ])
        })
    })

    describe('byteLength and formatBytes', () => {
        it('measures UTF-8 byte lengths accurately', () => {
            expect(MetadataKeyAnalyzer.byteLength('abc')).toBe(3)
            expect(MetadataKeyAnalyzer.byteLength('привет')).toBe(12)
        })

        it('formats bytes, kilobytes, and megabytes', () => {
            expect(MetadataKeyAnalyzer.formatBytes(0)).toBe('0 B')
            expect(MetadataKeyAnalyzer.formatBytes(512)).toBe('512 B')
            expect(MetadataKeyAnalyzer.formatBytes(1024)).toBe('1.0 KB')
            expect(MetadataKeyAnalyzer.formatBytes(2560)).toBe('2.5 KB')
            expect(MetadataKeyAnalyzer.formatBytes(1024 * 1024)).toBe('1.0 MB')
            expect(MetadataKeyAnalyzer.formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB')
        })
    })

    describe('MetadataKeyCatalog', () => {
        it('describes exact keys, prefix keys, and returns empty string for unknown or prototype keys', () => {
            expect(MetadataKeyCatalog.describe('app.kubernetes.io/name')).toBe('Name of the application')
            expect(MetadataKeyCatalog.describe('node-role.kubernetes.io/control-plane')).toBe(
                'Kubernetes node role assignment'
            )
            expect(MetadataKeyCatalog.describe('field.cattle.io/publicEndpoints')).toBe(
                'Public endpoints exposed by Rancher for this workload, Service, or Ingress'
            )
            expect(MetadataKeyAnalyzer.split('field.cattle.io/publicEndpoints').domainGroup).toBe('cattle.io')
            expect(MetadataKeyCatalog.describe('checksum/config')).toContain('Content digest')
            expect(MetadataKeyCatalog.describe('unknown.example.io/foo')).toBe('')
            expect(MetadataKeyCatalog.describe('toString')).toBe('')
        })
    })
})
