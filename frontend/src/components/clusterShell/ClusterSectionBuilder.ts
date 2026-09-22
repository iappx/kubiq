import { KubeSectionCatalog } from '@/domain/models/kube'
import type { KubeResourceKind, TKubeSection } from '@/domain/models/kube'
import type { TClusterMenuItem } from '@/components/clusterShell/types/TClusterMenuItem'
import type { TClusterSection } from '@/components/clusterShell/types/TClusterSection'
import type { TClusterSubGroup } from '@/components/clusterShell/types/TClusterSubGroup'

export class ClusterSectionBuilder {
    public static readonly coreGroupTitle: string = 'Core group'

    public static build(kinds: readonly KubeResourceKind[]): TClusterSection[] {
        const bySection = ClusterSectionBuilder.group(kinds)

        return KubeSectionCatalog.all()
            .filter(section => (bySection.get(section) ?? []).length > 0)
            .map(section => ClusterSectionBuilder.section(section, bySection.get(section) ?? []))
    }

    public static toItem(kind: KubeResourceKind): TClusterMenuItem {
        return {
            key: kind.key,
            title: kind.title,
            icon: kind.icon,
            slug: kind.slug,
            group: kind.group,
            section: kind.section,
            namespaced: kind.namespaced,
        }
    }

    public static findBySlug(sections: readonly TClusterSection[], slug: string): TClusterMenuItem | undefined {
        for (const section of sections) {
            const found = section.items.find(item => item.slug === slug)
            if (found) {
                return found
            }
        }

        return undefined
    }

    public static first(sections: readonly TClusterSection[]): TClusterMenuItem | undefined {
        return sections[0]?.items[0]
    }

    public static groupOf(section: TClusterSection, slug: string): TClusterSubGroup | undefined {
        return section.groups.find(group => group.items.some(item => item.slug === slug))
    }

    private static section(key: TKubeSection, items: TClusterMenuItem[]): TClusterSection {
        const title = KubeSectionCatalog.title(key)

        if (key !== KubeSectionCatalog.custom) {
            return { key, title, items: ClusterSectionBuilder.sort(items), groups: [] }
        }

        const groups = ClusterSectionBuilder.subGroups(items)

        return { key, title, items: groups.flatMap(group => group.items), groups }
    }

    private static subGroups(items: TClusterMenuItem[]): TClusterSubGroup[] {
        const byGroup = new Map<string, TClusterMenuItem[]>()

        items.forEach((item) => {
            const members = byGroup.get(item.group) ?? []
            members.push(item)
            byGroup.set(item.group, members)
        })

        return [...byGroup.entries()]
            .sort(([left], [right]) => ClusterSectionBuilder.compareGroups(left, right))
            .map(([group, members]) => ({
                key: `group:${group}`,
                title: group.length > 0 ? group : ClusterSectionBuilder.coreGroupTitle,
                items: ClusterSectionBuilder.sort(members),
            }))
    }

    private static compareGroups(left: string, right: string): number {
        if (left === '') {
            return 1
        }
        if (right === '') {
            return -1
        }

        return left.localeCompare(right)
    }

    private static group(kinds: readonly KubeResourceKind[]): Map<TKubeSection, TClusterMenuItem[]> {
        const bySection = new Map<TKubeSection, TClusterMenuItem[]>()

        kinds.forEach((kind) => {
            const section = KubeSectionCatalog.has(kind.section) ? kind.section : KubeSectionCatalog.custom
            const items = bySection.get(section) ?? []
            items.push(ClusterSectionBuilder.toItem(kind))
            bySection.set(section, items)
        })

        return bySection
    }

    private static sort(items: TClusterMenuItem[]): TClusterMenuItem[] {
        return [...items].sort((a, b) => a.title.localeCompare(b.title))
    }
}
