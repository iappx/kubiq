import type { TClusterObjectTarget } from '@/components/clusterShell/types/TClusterObjectTarget'
import type { KubeResourceKind } from '@/domain/models/kube'
import type { TKubeSection } from '@/domain/models/kube'

export class ClusterRoutes {
    public static readonly base: string = '/cluster'

    public static readonly catalog: string = '/app/clusters'

    public static readonly settings: string = '/app/settings'

    public static readonly namespaceKey: string = 'ns'

    public static readonly nameKey: string = 'name'

    public static readonly tabKey: string = 'tab'

    public static shell(clusterId: string): string {
        return `${ClusterRoutes.base}/${ClusterRoutes.segment(clusterId)}`
    }

    public static overview(clusterId: string): string {
        return `${ClusterRoutes.shell(clusterId)}/overview`
    }

    public static helm(clusterId: string): string {
        return `${ClusterRoutes.shell(clusterId)}/helm`
    }

    public static forKind(clusterId: string, kind: KubeResourceKind): string {
        return ClusterRoutes.resource(clusterId, kind.section, kind.slug)
    }

    public static resource(clusterId: string, section: TKubeSection, slug: string): string {
        return `${ClusterRoutes.shell(clusterId)}/${ClusterRoutes.segment(section)}/${ClusterRoutes.segment(slug)}`
    }

    public static object(clusterId: string, kind: KubeResourceKind, target: TClusterObjectTarget): string {
        return `${ClusterRoutes.forKind(clusterId, kind)}${ClusterRoutes.selection(target)}`
    }

    public static isCluster(path: string): boolean {
        return path === ClusterRoutes.base || path.startsWith(`${ClusterRoutes.base}/`)
    }

    private static selection(target: TClusterObjectTarget): string {
        const pairs = [
            ClusterRoutes.pair(ClusterRoutes.namespaceKey, target.namespace),
            ClusterRoutes.pair(ClusterRoutes.nameKey, target.name),
            ClusterRoutes.pair(ClusterRoutes.tabKey, target.tab ?? ''),
        ].filter(pair => pair !== '')

        return pairs.length > 0 ? `?${pairs.join('&')}` : ''
    }

    private static pair(key: string, value: string): string {
        return value === '' ? '' : `${key}=${ClusterRoutes.segment(value)}`
    }

    private static segment(value: string): string {
        return encodeURIComponent(value)
    }
}
