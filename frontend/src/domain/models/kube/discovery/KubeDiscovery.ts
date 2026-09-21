import { KubeColumns } from '@/domain/models/kube/KubeColumns'
import { KubeResourceKind } from '@/domain/models/kube/KubeResourceKind'
import { KubeResourceRegistry } from '@/domain/models/kube/KubeResourceRegistry'
import { KubeSectionCatalog } from '@/domain/models/kube/KubeSectionCatalog'
import { KubeVerbCatalog } from '@/domain/models/kube/KubeVerbCatalog'
import { KubeCrdReader } from '@/domain/models/kube/discovery/KubeCrdReader'
import { KubeVersionComparer } from '@/domain/models/kube/discovery/KubeVersionComparer'
import type { TKubeGvr } from '@/domain/models/kube/types/TKubeGvr'
import type { TApiResourceDocument } from '@/domain/models/kube/discovery/types/TApiResourceDocument'
import type { TApiResourceListDocument } from '@/domain/models/kube/discovery/types/TApiResourceListDocument'
import type { TKubeDiscoveryInput } from '@/domain/models/kube/discovery/types/TKubeDiscoveryInput'

export class KubeDiscovery {
    public static readonly coreGroup: string = ''

    public static discover(input: TKubeDiscoveryInput): KubeResourceKind[] {
        const preferred = KubeDiscovery.preferredVersions(input)
        const kinds = new Map<string, KubeResourceKind>()
        const lists = input.resourceLists ?? []
        for (let i = 0; i < lists.length; i++) {
            const list = lists[i]
            const groupVersion = KubeDiscovery.parseGroupVersion(list.groupVersion)
            if (!groupVersion || preferred.get(groupVersion.group) !== groupVersion.version) {
                continue
            }
            KubeDiscovery.collect(list, groupVersion.group, groupVersion.version, kinds)
        }
        KubeDiscovery.applyCrds(input.crds ?? [], kinds)
        return KubeDiscovery.sort([...kinds.values()])
    }

    public static preferredVersions(input: TKubeDiscoveryInput): Map<string, string> {
        const preferred = new Map<string, string>()
        const coreVersion = KubeVersionComparer.best(input.coreVersions?.versions ?? [])
        if (coreVersion) {
            preferred.set(KubeDiscovery.coreGroup, coreVersion)
        }
        const groups = input.groups?.groups ?? []
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i]
            if (group.name === undefined) {
                continue
            }
            const declared = group.preferredVersion?.version
            const version = declared ?? KubeVersionComparer.best((group.versions ?? []).map(p => p.version ?? ''))
            if (version) {
                preferred.set(group.name, version)
            }
        }
        KubeDiscovery.fillFromResourceLists(input.resourceLists ?? [], preferred)
        return preferred
    }

    public static parseGroupVersion(groupVersion: string | undefined): { group: string; version: string } | undefined {
        if (!groupVersion) {
            return undefined
        }
        const separator = groupVersion.indexOf('/')
        if (separator === -1) {
            return { group: KubeDiscovery.coreGroup, version: groupVersion }
        }
        return {
            group: groupVersion.slice(0, separator),
            version: groupVersion.slice(separator + 1),
        }
    }

    public static isListable(resource: TApiResourceDocument): boolean {
        if (!resource.name || !resource.kind) {
            return false
        }
        // A subresource such as `pods/log` is reached through its parent and
        // never appears in the menu as a kind of its own.
        if (resource.name.includes('/')) {
            return false
        }
        return (resource.verbs ?? []).includes('list')
    }

    // A group missing from /apis still has to get a version from somewhere when
    // the caller only handed over the resource lists.
    private static fillFromResourceLists(lists: TApiResourceListDocument[], preferred: Map<string, string>): void {
        const byGroup = new Map<string, string[]>()
        for (let i = 0; i < lists.length; i++) {
            const groupVersion = KubeDiscovery.parseGroupVersion(lists[i].groupVersion)
            if (!groupVersion || preferred.has(groupVersion.group)) {
                continue
            }
            const versions = byGroup.get(groupVersion.group) ?? []
            versions.push(groupVersion.version)
            byGroup.set(groupVersion.group, versions)
        }
        byGroup.forEach((versions, group) => {
            const version = KubeVersionComparer.best(versions)
            if (version) {
                preferred.set(group, version)
            }
        })
    }

    private static collect(
        list: TApiResourceListDocument,
        group: string,
        version: string,
        kinds: Map<string, KubeResourceKind>,
    ): void {
        const resources = list.resources ?? []
        for (let i = 0; i < resources.length; i++) {
            const resource = resources[i]
            if (!KubeDiscovery.isListable(resource)) {
                continue
            }
            const kind = KubeDiscovery.toKind({ group, version, resource: resource.name as string }, resource)
            kinds.set(kind.key, kind)
        }
    }

    private static toKind(gvr: TKubeGvr, resource: TApiResourceDocument): KubeResourceKind {
        const verbs = KubeVerbCatalog.known(resource.verbs)
        const namespaced = resource.namespaced === true
        const known = KubeResourceRegistry.find(gvr.group, gvr.resource)
        if (known) {
            return known.withDefinition({ version: gvr.version, namespaced, verbs })
        }
        return new KubeResourceKind({
            group: gvr.group,
            version: gvr.version,
            resource: gvr.resource,
            kind: resource.kind as string,
            title: resource.kind as string,
            namespaced,
            section: KubeSectionCatalog.custom,
            icon: KubeCrdReader.icon,
            columns: KubeColumns.baseWithAge(namespaced),
            verbs,
            isCustom: true,
        })
    }

    // The CRD is the better source for columns and scope; discovery stays the
    // authority on verbs, because those reflect what this cluster actually allows.
    private static applyCrds(crds: TKubeDiscoveryInput['crds'], kinds: Map<string, KubeResourceKind>): void {
        const documents = crds ?? []
        for (let i = 0; i < documents.length; i++) {
            const fromCrd = KubeCrdReader.read(documents[i])
            for (let j = 0; j < fromCrd.length; j++) {
                const kind = fromCrd[j]
                const discovered = kinds.get(kind.key)
                if (!discovered) {
                    kinds.set(kind.key, kind)
                    continue
                }
                kinds.set(kind.key, discovered.withDefinition({
                    columns: kind.columns,
                    namespaced: kind.namespaced,
                    section: kind.section,
                    icon: kind.icon,
                    isCustom: true,
                }))
            }
        }
    }

    private static sort(kinds: KubeResourceKind[]): KubeResourceKind[] {
        return kinds.sort((a, b) => {
            const bySection = KubeSectionCatalog.orderOf(a.section) - KubeSectionCatalog.orderOf(b.section)
            return bySection !== 0 ? bySection : a.title.localeCompare(b.title)
        })
    }
}
