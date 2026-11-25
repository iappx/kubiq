import type { IMetadataValueParser } from '@/domain/models/metadata/interfaces/IMetadataValueParser'
import { MetadataKeyAnalyzer } from '@/domain/models/metadata/MetadataKeyAnalyzer'
import type { TMetadataParseContext } from '@/domain/models/metadata/types/TMetadataParseContext'
import type { TMetadataParsedValue } from '@/domain/models/metadata/types/TMetadataParsedValue'
import type { TMetadataStructuredField } from '@/domain/models/metadata/types/TMetadataStructuredField'

export class MetadataKubeSemanticParser implements IMetadataValueParser {
    private static readonly domainListKeys: ReadonlySet<string> = new Set([
        'cert-manager.io/alt-names',
        'cert-manager.io/ip-sans',
        'external-dns.alpha.kubernetes.io/hostname',
    ])

    private static readonly cidrListKeys: ReadonlySet<string> = new Set([
        'nginx.ingress.kubernetes.io/whitelist-source-range',
        'nginx.ingress.kubernetes.io/denylist-source-range',
        'service.beta.kubernetes.io/load-balancer-source-ranges',
    ])

    private static readonly defaultClassBooleanKeys: ReadonlySet<string> = new Set([
        'storageclass.kubernetes.io/is-default-class',
        'ingressclass.kubernetes.io/is-default-class',
    ])

    public parse(key: string, value: string, context: TMetadataParseContext): TMetadataParsedValue | null {
        const trimmed = value.trim()
        if (!trimmed || context.kind !== 'annotation') {
            return null
        }

        if (key === 'kubectl.kubernetes.io/last-applied-configuration') {
            return this.parseLastApplied(value, trimmed)
        }

        if (key === 'control-plane.alpha.kubernetes.io/leader') {
            return this.parseLeaderElection(trimmed)
        }

        if (key === 'k8s.v1.cni.cncf.io/network-status') {
            return this.parseNetworkStatus(trimmed)
        }

        if (key === 'field.cattle.io/publicEndpoints') {
            return this.parsePublicEndpoints(trimmed, context.namespace)
        }

        if (key === 'kubernetes.io/service-account.name') {
            return {
                kind: 'reference',
                label: trimmed,
                target: {
                    kindName: 'ServiceAccount',
                    apiVersion: 'v1',
                    name: trimmed,
                    namespace: context.namespace,
                    routeKind: 'kube',
                },
            }
        }

        if (key === 'meta.helm.sh/release-name') {
            const releaseNamespace = context.allAnnotations['meta.helm.sh/release-namespace']?.trim() || context.namespace

            return {
                kind: 'reference',
                label: trimmed,
                target: {
                    kindName: 'HelmRelease',
                    apiVersion: '',
                    name: trimmed,
                    namespace: releaseNamespace,
                    routeKind: 'helm',
                },
            }
        }

        if (key === 'cert-manager.io/cluster-issuer') {
            return {
                kind: 'reference',
                label: trimmed,
                target: {
                    kindName: 'ClusterIssuer',
                    apiVersion: 'cert-manager.io/v1',
                    name: trimmed,
                    namespace: '',
                    routeKind: 'kube',
                },
            }
        }

        if (key === 'cert-manager.io/issuer-name' || key === 'cert-manager.io/issuer') {
            const issuerKind = context.allAnnotations['cert-manager.io/issuer-kind']?.trim() || 'Issuer'
            const issuerNamespace = issuerKind === 'ClusterIssuer' ? '' : context.namespace

            return {
                kind: 'reference',
                label: trimmed,
                target: {
                    kindName: issuerKind,
                    apiVersion: 'cert-manager.io/v1',
                    name: trimmed,
                    namespace: issuerNamespace,
                    routeKind: 'kube',
                },
            }
        }

        if (key === 'kubernetes.io/ingress.class') {
            return {
                kind: 'reference',
                label: trimmed,
                target: {
                    kindName: 'IngressClass',
                    apiVersion: 'networking.k8s.io/v1',
                    name: trimmed,
                    namespace: '',
                    routeKind: 'kube',
                },
            }
        }

        if (key === 'volume.beta.kubernetes.io/storage-class') {
            return {
                kind: 'reference',
                label: trimmed,
                target: {
                    kindName: 'StorageClass',
                    apiVersion: 'storage.k8s.io/v1',
                    name: trimmed,
                    namespace: '',
                    routeKind: 'kube',
                },
            }
        }

        if (MetadataKubeSemanticParser.domainListKeys.has(key)) {
            return this.parseCommaList(trimmed, 'domain')
        }

        if (MetadataKubeSemanticParser.cidrListKeys.has(key)) {
            return this.parseCommaList(trimmed, 'cidr')
        }

        if (key === 'helm.sh/hook') {
            return this.parseCommaList(trimmed, 'text')
        }

        if (this.isSecurityProfileKey(key)) {
            return this.parseSecurityProfile(trimmed)
        }

        if (MetadataKubeSemanticParser.defaultClassBooleanKeys.has(key)) {
            const lower = trimmed.toLowerCase()
            if (lower === 'true' || lower === 'false') {
                return { kind: 'boolean', value: lower === 'true' }
            }
        }

        return null
    }

    private parseLastApplied(raw: string, trimmed: string): TMetadataParsedValue | null {
        const parsed = this.tryParseJsonObject(trimmed)
        if (!parsed) {
            return null
        }

        return {
            kind: 'json',
            value: parsed,
            isArray: false,
            itemCount: Object.keys(parsed).length,
            byteSize: MetadataKeyAnalyzer.byteLength(raw),
            isLastApplied: true,
        }
    }

    private parseLeaderElection(trimmed: string): TMetadataParsedValue | null {
        const parsed = this.tryParseJsonObject(trimmed)
        if (!parsed) {
            return null
        }

        const fields: TMetadataStructuredField[] = []
        const holder = typeof parsed.holderIdentity === 'string' ? parsed.holderIdentity : ''

        if (holder) {
            fields.push({ label: 'Holder', value: holder, mono: true })
        }
        if (typeof parsed.leaseDurationSeconds === 'number') {
            fields.push({ label: 'Lease duration', value: `${parsed.leaseDurationSeconds}s`, mono: true })
        }
        if (typeof parsed.acquireTime === 'string' && parsed.acquireTime) {
            fields.push({ label: 'Acquire time', value: parsed.acquireTime, mono: true })
        }
        if (typeof parsed.renewTime === 'string' && parsed.renewTime) {
            fields.push({ label: 'Renew time', value: parsed.renewTime, mono: true })
        }
        if (typeof parsed.leaderTransitions === 'number') {
            fields.push({ label: 'Transitions', value: String(parsed.leaderTransitions), mono: true })
        }

        if (fields.length === 0) {
            return null
        }

        return {
            kind: 'structured',
            badge: 'Leader election',
            summary: holder || 'Active lease',
            fields,
        }
    }

    private parseNetworkStatus(trimmed: string): TMetadataParsedValue | null {
        let parsed: unknown
        try {
            parsed = JSON.parse(trimmed)
        } catch {
            return null
        }

        if (!Array.isArray(parsed)) {
            return null
        }

        const fields: TMetadataStructuredField[] = []
        parsed.forEach((entry, index) => {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                return
            }

            const record = entry as Record<string, unknown>
            const iface = typeof record.interface === 'string' ? record.interface.trim() : ''
            const name = typeof record.name === 'string' ? record.name.trim() : ''
            const label = iface && name
                ? `${iface} (${name})`
                : (iface || name || `interface-${index + 1}`)

            const ips = Array.isArray(record.ips)
                ? record.ips.filter((ip): ip is string => typeof ip === 'string' && ip.trim().length > 0)
                : []
            const mac = typeof record.mac === 'string' ? record.mac.trim() : ''
            const baseValue = ips.length > 0 ? ips.join(', ') : (mac || 'No IP')
            const isDefault = record.default === true
            const value = isDefault ? `${baseValue} (default)` : baseValue

            fields.push({
                label,
                value,
                mono: true,
                ...(isDefault ? { tone: 'ok' as const } : {}),
            })
        })

        const count = fields.length

        return {
            kind: 'structured',
            badge: 'Network status',
            summary: count === 1 ? '1 interface' : `${count} interfaces`,
            fields,
        }
    }

    private parsePublicEndpoints(trimmed: string, defaultNamespace: string): TMetadataParsedValue | null {
        let parsed: unknown
        try {
            parsed = JSON.parse(trimmed)
        } catch {
            return null
        }

        if (!Array.isArray(parsed)) {
            return null
        }

        const endpoints = parsed.filter(
            (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
        )
        if (endpoints.length === 0) {
            return null
        }

        const fields: TMetadataStructuredField[] = []
        let firstEndpointSummary = ''

        endpoints.forEach((record, index) => {
            const prefix = endpoints.length > 1 ? `#${index + 1} ` : ''
            const protocol = typeof record.protocol === 'string' ? record.protocol.trim().toUpperCase() : ''
            const port = typeof record.port === 'number' && Number.isFinite(record.port) ? record.port : null
            const hostname = typeof record.hostname === 'string' ? record.hostname.trim() : ''
            const path = typeof record.path === 'string' ? record.path.trim() : ''
            const addresses = Array.isArray(record.addresses)
                ? record.addresses
                    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                    .map(item => item.trim())
                : []

            const primary = this.formatPublicEndpoint(protocol, port, hostname, path, addresses)
            if (!firstEndpointSummary) {
                firstEndpointSummary = primary.value
            }

            fields.push({
                label: `${prefix}Endpoint`,
                value: primary.value,
                mono: true,
                ...(primary.url ? { url: primary.url } : {}),
            })

            const showAddresses = addresses.length > 0 && (
                hostname !== ''
                || ((protocol === 'HTTP' || protocol === 'HTTPS') && addresses.length > 1)
            )
            if (showAddresses) {
                fields.push({
                    label: `${prefix}Addresses`,
                    value: addresses.join(', '),
                    mono: true,
                })
            }

            const ingressName = typeof record.ingressName === 'string' ? record.ingressName.trim() : ''
            if (ingressName) {
                const ref = this.splitRancherRef(ingressName, defaultNamespace)
                fields.push({
                    label: `${prefix}Ingress`,
                    value: ingressName,
                    mono: true,
                    reference: {
                        kindName: 'Ingress',
                        apiVersion: 'networking.k8s.io/v1',
                        name: ref.name,
                        namespace: ref.namespace,
                        routeKind: 'kube',
                    },
                })
            }

            const serviceName = typeof record.serviceName === 'string' ? record.serviceName.trim() : ''
            if (serviceName) {
                const ref = this.splitRancherRef(serviceName, defaultNamespace)
                fields.push({
                    label: `${prefix}Service`,
                    value: serviceName,
                    mono: true,
                    reference: {
                        kindName: 'Service',
                        apiVersion: 'v1',
                        name: ref.name,
                        namespace: ref.namespace,
                        routeKind: 'kube',
                    },
                })
            }

            const podName = typeof record.podName === 'string' ? record.podName.trim() : ''
            if (podName) {
                const ref = this.splitRancherRef(podName, defaultNamespace)
                fields.push({
                    label: `${prefix}Pod`,
                    value: podName,
                    mono: true,
                    reference: {
                        kindName: 'Pod',
                        apiVersion: 'v1',
                        name: ref.name,
                        namespace: ref.namespace,
                        routeKind: 'kube',
                    },
                })
            }

            const nodeName = typeof record.nodeName === 'string' ? record.nodeName.trim() : ''
            if (nodeName) {
                const colon = nodeName.indexOf(':')
                const resolvedNode = colon >= 0 ? nodeName.slice(colon + 1) : nodeName
                fields.push({
                    label: `${prefix}Node`,
                    value: resolvedNode,
                    mono: true,
                    reference: {
                        kindName: 'Node',
                        apiVersion: 'v1',
                        name: resolvedNode,
                        namespace: '',
                        routeKind: 'kube',
                    },
                })
            }

            if (record.allNodes === true) {
                fields.push({
                    label: `${prefix}Scope`,
                    value: 'All nodes',
                    tone: 'info',
                })
            }
        })

        return {
            kind: 'structured',
            badge: 'Public endpoints',
            summary: endpoints.length === 1 ? firstEndpointSummary : `${endpoints.length} endpoints`,
            fields,
        }
    }

    private formatPublicEndpoint(
        protocol: string,
        port: number | null,
        hostname: string,
        path: string,
        addresses: readonly string[],
    ): { value: string; url?: string } {
        const isHttp = protocol === 'HTTP' || protocol === 'HTTPS'
        const primaryHost = hostname || addresses[0] || ''

        if (isHttp && primaryHost) {
            const scheme = protocol.toLowerCase()
            const hostPart = primaryHost.includes(':') && !primaryHost.startsWith('[')
                ? `[${primaryHost}]`
                : primaryHost
            const defaultPort = scheme === 'https' ? 443 : 80
            const portPart = port !== null && port !== defaultPort ? `:${port}` : ''
            const pathPart = path ? (path.startsWith('/') ? path : `/${path}`) : ''
            const url = `${scheme}://${hostPart}${portPart}${pathPart}`

            return { value: url, url }
        }

        const targets = hostname
            ? [hostname]
            : addresses
        const formattedTargets = targets
            .map((host) => {
                const hostPart = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host

                return port !== null ? `${hostPart}:${port}` : hostPart
            })
            .join(', ')
        const target = formattedTargets || (port !== null ? `:${port}` : '')
        const withProtocol = target && protocol
            ? `${target} (${protocol})`
            : (target || protocol || 'Endpoint')

        return { value: withProtocol }
    }

    private splitRancherRef(raw: string, fallbackNamespace: string): { namespace: string; name: string } {
        const colon = raw.indexOf(':')
        if (colon > 0 && colon < raw.length - 1) {
            return {
                namespace: raw.slice(0, colon),
                name: raw.slice(colon + 1),
            }
        }

        return {
            namespace: fallbackNamespace,
            name: raw,
        }
    }

    private parseCommaList(trimmed: string, itemKind: 'cidr' | 'domain' | 'text'): TMetadataParsedValue | null {
        const items = trimmed
            .split(',')
            .map(part => part.trim())
            .filter(part => part.length > 0)

        if (items.length === 0) {
            return null
        }

        return {
            kind: 'list',
            items,
            separator: ',',
            itemKind,
        }
    }

    private isSecurityProfileKey(key: string): boolean {
        return key === 'seccomp.security.alpha.kubernetes.io/pod'
            || key.startsWith('container.seccomp.security.alpha.kubernetes.io/')
            || key.startsWith('container.apparmor.security.beta.kubernetes.io/')
    }

    private parseSecurityProfile(trimmed: string): TMetadataParsedValue {
        const slash = trimmed.indexOf('/')
        const fields: TMetadataStructuredField[] = slash > 0
            ? [
                { label: 'Type', value: trimmed.slice(0, slash), mono: true },
                { label: 'Profile', value: trimmed.slice(slash + 1), mono: true },
            ]
            : [{ label: 'Type', value: trimmed, mono: true }]

        return {
            kind: 'structured',
            badge: 'Security profile',
            summary: trimmed,
            fields,
        }
    }

    private tryParseJsonObject(trimmed: string): Record<string, unknown> | null {
        try {
            const parsed: unknown = JSON.parse(trimmed)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>
            }

            return null
        } catch {
            return null
        }
    }
}
