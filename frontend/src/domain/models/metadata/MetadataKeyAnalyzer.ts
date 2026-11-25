import type { TMetadataEntry } from '@/domain/models/metadata/types/TMetadataEntry'
import type { TMetadataGroup } from '@/domain/models/metadata/types/TMetadataGroup'
import type { TMetadataKeyParts } from '@/domain/models/metadata/types/TMetadataKeyParts'

export class MetadataKeyAnalyzer {
    public static readonly customGroup: string = 'Custom'

    public static readonly noisyGroup: string = 'System / Generated'

    private static readonly noisyExactKeys: ReadonlySet<string> = new Set([
        'kubectl.kubernetes.io/last-applied-configuration',
        'kubernetes.io/config.hash',
        'kubernetes.io/config.mirror',
        'kubernetes.io/config.seen',
        'kubernetes.io/config.source',
        'node.alpha.kubernetes.io/ttl',
        'volumes.kubernetes.io/controller-managed-attach-detach',
        'autoscaling.alpha.kubernetes.io/current-metrics',
        'autoscaling.alpha.kubernetes.io/conditions',
        'control-plane.alpha.kubernetes.io/leader',
    ])

    private static readonly noisyPrefixes: readonly string[] = [
        'checksum/',
        'cni.projectcalico.org/',
        'k8s.v1.cni.cncf.io/',
    ]

    private static readonly encoder: TextEncoder = new TextEncoder()

    public static split(key: string): TMetadataKeyParts {
        const slashIndex = key.indexOf('/')
        const hasPrefix = slashIndex > 0
        const prefix = hasPrefix ? key.slice(0, slashIndex) : ''
        const name = slashIndex === -1 ? key : key.slice(slashIndex + 1)
        const domainGroup = hasPrefix
            ? MetadataKeyAnalyzer.normalizeDomainGroup(prefix)
            : MetadataKeyAnalyzer.customGroup

        return {
            raw: key,
            prefix,
            name,
            domainGroup,
            isNoisy: MetadataKeyAnalyzer.isNoisyKey(key),
        }
    }

    public static group(entries: readonly TMetadataEntry[]): TMetadataGroup[] {
        const buckets = new Map<string, TMetadataEntry[]>()
        const noisyEntries: TMetadataEntry[] = []

        for (const entry of entries) {
            if (entry.keyParts.isNoisy) {
                noisyEntries.push(entry)
                continue
            }

            const title = entry.keyParts.domainGroup
            const existing = buckets.get(title)
            if (existing) {
                existing.push(entry)
            } else {
                buckets.set(title, [entry])
            }
        }

        const titles = Array.from(buckets.keys()).sort((a, b) => {
            if (a === MetadataKeyAnalyzer.customGroup && b !== MetadataKeyAnalyzer.customGroup) {
                return 1
            }
            if (b === MetadataKeyAnalyzer.customGroup && a !== MetadataKeyAnalyzer.customGroup) {
                return -1
            }
            return a.localeCompare(b)
        })

        const groups: TMetadataGroup[] = titles.map((title) => ({
            id: MetadataKeyAnalyzer.toGroupId(title),
            title,
            entries: buckets.get(title) ?? [],
            isNoisy: false,
        }))

        if (noisyEntries.length > 0) {
            groups.push({
                id: 'system-generated',
                title: MetadataKeyAnalyzer.noisyGroup,
                entries: noisyEntries,
                isNoisy: true,
            })
        }

        return groups
    }

    public static filter(entries: readonly TMetadataEntry[], query: string): TMetadataEntry[] {
        const normalized = query.trim().toLowerCase()
        if (!normalized) {
            return [...entries]
        }

        return entries.filter((entry) => {
            if (entry.key.toLowerCase().includes(normalized)) {
                return true
            }
            if (entry.rawValue.toLowerCase().includes(normalized)) {
                return true
            }
            if (entry.description.toLowerCase().includes(normalized)) {
                return true
            }
            if (entry.parsed.kind === 'structured') {
                if (entry.parsed.badge.toLowerCase().includes(normalized)) {
                    return true
                }
                if (entry.parsed.summary.toLowerCase().includes(normalized)) {
                    return true
                }
            }
            return false
        })
    }

    public static formatBytes(bytes: number): string {
        if (bytes < 1024) {
            return `${bytes} B`
        }
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    public static byteLength(text: string): number {
        return MetadataKeyAnalyzer.encoder.encode(text).length
    }

    private static normalizeDomainGroup(prefix: string): string {
        if (prefix === 'nginx.ingress.kubernetes.io') {
            return 'nginx.ingress.kubernetes.io'
        }
        if (
            prefix === 'kubernetes.io' ||
            prefix.endsWith('.kubernetes.io') ||
            prefix === 'k8s.io' ||
            prefix.endsWith('.k8s.io')
        ) {
            return 'kubernetes.io'
        }
        if (prefix === 'argoproj.io' || prefix.endsWith('.argoproj.io')) {
            return 'argoproj.io'
        }
        if (prefix === 'meta.helm.sh' || prefix === 'helm.sh') {
            return 'helm.sh'
        }
        if (prefix === 'cert-manager.io' || prefix.endsWith('.cert-manager.io')) {
            return 'cert-manager.io'
        }
        if (prefix === 'prometheus.io' || prefix.endsWith('.prometheus.io')) {
            return 'prometheus.io'
        }
        if (prefix === 'cattle.io' || prefix.endsWith('.cattle.io')) {
            return 'cattle.io'
        }
        return prefix
    }

    private static isNoisyKey(key: string): boolean {
        if (MetadataKeyAnalyzer.noisyExactKeys.has(key)) {
            return true
        }
        for (const prefix of MetadataKeyAnalyzer.noisyPrefixes) {
            if (key.startsWith(prefix)) {
                return true
            }
        }
        return false
    }

    private static toGroupId(title: string): string {
        return title.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '')
    }
}
