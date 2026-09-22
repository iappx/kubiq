import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import type { KubeResourceKind } from '@/domain/models/kube'
import type { TCommandItem } from '@/components/clusterShell/types/TCommandItem'
import type { TCommandPaletteInput } from '@/components/clusterShell/types/TCommandPaletteInput'

export class CommandPaletteIndex {
    public static readonly visibleCap: number = 8

    public static readonly resourceGroup: string = 'Resources'

    public static readonly clusterGroup: string = 'Clusters'

    public static readonly namespaceGroup: string = 'Namespaces'

    public static build(input: TCommandPaletteInput): TCommandItem[] {
        return [
            ...CommandPaletteIndex.resources(input),
            ...CommandPaletteIndex.clusters(input),
            ...CommandPaletteIndex.namespaces(input),
        ]
    }

    public static filter(items: readonly TCommandItem[], query: string, recentKeys: readonly string[]): TCommandItem[] {
        const matched = CommandPaletteIndex.matching(items, query)
        const recent = recentKeys
            .map(key => matched.find(item => item.key === key))
            .filter((item): item is TCommandItem => item !== undefined)

        const rest = matched.filter(item => !recentKeys.includes(item.key))

        return [...recent, ...rest].slice(0, CommandPaletteIndex.visibleCap)
    }

    public static remember(recentKeys: readonly string[], key: string): string[] {
        return [key, ...recentKeys.filter(known => known !== key)].slice(0, CommandPaletteIndex.visibleCap)
    }

    public static nextCursor(current: number, delta: number, count: number): number {
        if (count === 0) {
            return 0
        }

        return ((current + delta) % count + count) % count
    }

    private static matching(items: readonly TCommandItem[], query: string): TCommandItem[] {
        const needle = query.trim().toLowerCase()
        if (needle === '') {
            return [...items]
        }

        return items.filter(item => CommandPaletteIndex.haystack(item).includes(needle))
    }

    private static haystack(item: TCommandItem): string {
        return `${item.label} ${item.hint ?? ''} ${item.group}`.toLowerCase()
    }

    private static resources(input: TCommandPaletteInput): TCommandItem[] {
        if (input.clusterId === '') {
            return []
        }

        return input.kinds.map(kind => ({
            key: `kind:${kind.key}`,
            label: kind.title,
            hint: CommandPaletteIndex.apiGroupHint(kind),
            group: CommandPaletteIndex.resourceGroup,
            path: ClusterRoutes.forKind(input.clusterId, kind),
            icon: kind.icon,
        }))
    }

    private static apiGroupHint(kind: KubeResourceKind): string {
        return kind.group.length > 0 ? kind.group : kind.apiVersion
    }

    private static clusters(input: TCommandPaletteInput): TCommandItem[] {
        const catalog: TCommandItem = {
            key: 'cluster:catalog',
            label: 'Cluster catalog',
            hint: 'All known contexts',
            group: CommandPaletteIndex.clusterGroup,
            path: ClusterRoutes.catalog,
            icon: 'FolderTree',
        }

        const connected = input.connections
            .filter(connection => connection.clusterId !== input.clusterId)
            .map(connection => ({
                key: `cluster:${connection.clusterId}`,
                label: connection.contextName,
                hint: connection.server,
                group: CommandPaletteIndex.clusterGroup,
                path: ClusterRoutes.shell(connection.clusterId),
                clusterId: connection.clusterId,
                icon: 'Server',
            }))

        return [...connected, catalog]
    }

    private static namespaces(input: TCommandPaletteInput): TCommandItem[] {
        if (input.clusterId === '') {
            return []
        }

        return input.namespaces.map(namespace => ({
            key: `namespace:${namespace}`,
            label: namespace,
            hint: 'Scope to this namespace',
            group: CommandPaletteIndex.namespaceGroup,
            namespace,
            icon: 'FolderTree',
        }))
    }
}
