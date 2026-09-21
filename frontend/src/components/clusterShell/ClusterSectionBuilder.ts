import { KubeSectionCatalog } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import type { TClusterMenuItem } from '@/components/clusterShell/types/TClusterMenuItem'
import type { TClusterSection } from '@/components/clusterShell/types/TClusterSection'

export class ClusterSectionBuilder {
    public static build(kinds: readonly KubeResourceKind[]): TClusterSection[] {
        const bySection = ClusterSectionBuilder.group(kinds)

        return KubeSectionCatalog.all()
            .filter(section => (bySection.get(section) ?? []).length > 0)
            .map(section => ({
                key: section,
                title: KubeSectionCatalog.title(section),
                items: ClusterSectionBuilder.sort(bySection.get(section) ?? []),
            }))
    }

    public static toItem(kind: KubeResourceKind): TClusterMenuItem {
        return {
            key: kind.key,
            title: kind.title,
            icon: kind.icon,
            slug: kind.slug,
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

    private static group(kinds: readonly KubeResourceKind[]): Map<string, TClusterMenuItem[]> {
        const bySection = new Map<string, TClusterMenuItem[]>()

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
