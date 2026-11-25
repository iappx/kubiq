import type { IMetadataValueParser } from '@/domain/models/metadata/interfaces/IMetadataValueParser'
import type { TMetadataParseContext } from '@/domain/models/metadata/types/TMetadataParseContext'
import type { TMetadataParsedValue } from '@/domain/models/metadata/types/TMetadataParsedValue'

export class MetadataArgoParser implements IMetadataValueParser {
    public parse(key: string, value: string, _context: TMetadataParseContext): TMetadataParsedValue | null {
        const trimmed = value.trim()
        if (!trimmed) {
            return null
        }

        if (key === 'argocd.argoproj.io/tracking-id') {
            return this.parseTrackingId(trimmed)
        }

        if (key === 'argocd.argoproj.io/sync-options' || key === 'argocd.argoproj.io/compare-options') {
            return this.parseKvOptions(trimmed)
        }

        if (key === 'argocd.argoproj.io/hook') {
            return this.parseHookList(trimmed)
        }

        if (key === 'argocd.argoproj.io/instance') {
            return {
                kind: 'reference',
                label: trimmed,
                target: {
                    kindName: 'Application',
                    apiVersion: 'argoproj.io/v1alpha1',
                    name: trimmed,
                    namespace: '',
                    routeKind: 'argocd',
                },
            }
        }

        return null
    }

    private parseTrackingId(trimmed: string): TMetadataParsedValue | null {
        const firstColon = trimmed.indexOf(':')
        if (firstColon <= 0) {
            return null
        }

        const secondColon = trimmed.indexOf(':', firstColon + 1)
        if (secondColon <= firstColon + 1) {
            return null
        }

        const app = trimmed.slice(0, firstColon).trim()
        const groupKindPart = trimmed.slice(firstColon + 1, secondColon).trim()
        const resourcePart = trimmed.slice(secondColon + 1).trim()

        if (!app || !groupKindPart || !resourcePart) {
            return null
        }

        const gkSlash = groupKindPart.indexOf('/')
        const group = gkSlash >= 0 ? groupKindPart.slice(0, gkSlash).trim() : ''
        const kindName = gkSlash >= 0 ? groupKindPart.slice(gkSlash + 1).trim() : groupKindPart

        if (!kindName) {
            return null
        }

        const resSlash = resourcePart.indexOf('/')
        const namespace = resSlash >= 0 ? resourcePart.slice(0, resSlash).trim() : ''
        const name = resSlash >= 0 ? resourcePart.slice(resSlash + 1).trim() : resourcePart

        if (!name) {
            return null
        }

        const groupKindDisplay = group ? `${group}/${kindName}` : kindName
        const resourceDisplay = namespace ? `${namespace}/${name}` : name
        const apiVersion = group ? `${group}/` : 'v1'

        return {
            kind: 'structured',
            badge: 'ArgoCD tracking',
            summary: app,
            fields: [
                {
                    label: 'Application',
                    value: app,
                    mono: true,
                    reference: {
                        kindName: 'Application',
                        apiVersion: 'argoproj.io/v1alpha1',
                        name: app,
                        namespace: '',
                        routeKind: 'argocd',
                    },
                },
                {
                    label: 'Group / Kind',
                    value: groupKindDisplay,
                    mono: true,
                },
                {
                    label: 'Resource',
                    value: resourceDisplay,
                    mono: true,
                    reference: {
                        kindName,
                        apiVersion,
                        name,
                        namespace,
                        routeKind: 'kube',
                    },
                },
            ],
        }
    }

    private parseKvOptions(trimmed: string): TMetadataParsedValue | null {
        const pairs = trimmed
            .split(',')
            .map(entry => entry.trim())
            .filter(entry => entry.length > 0)
            .map((entry) => {
                const eq = entry.indexOf('=')
                if (eq > 0) {
                    return {
                        key: entry.slice(0, eq).trim(),
                        value: entry.slice(eq + 1).trim(),
                    }
                }

                return {
                    key: entry,
                    value: 'true',
                }
            })

        if (pairs.length === 0) {
            return null
        }

        return {
            kind: 'kvList',
            pairs,
        }
    }

    private parseHookList(trimmed: string): TMetadataParsedValue | null {
        const items = trimmed
            .split(',')
            .map(entry => entry.trim())
            .filter(entry => entry.length > 0)

        if (items.length === 0) {
            return null
        }

        return {
            kind: 'list',
            items,
            separator: ',',
            itemKind: 'text',
        }
    }
}
