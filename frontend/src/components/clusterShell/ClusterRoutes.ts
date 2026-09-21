import type { KubeResourceKind } from '@/domain/models/kube'
import type { TKubeSection } from '@/domain/models/kube'

export class ClusterRoutes {
    public static readonly base: string = '/cluster'

    public static readonly catalog: string = '/app/clusters'

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

    public static isCluster(path: string): boolean {
        return path === ClusterRoutes.base || path.startsWith(`${ClusterRoutes.base}/`)
    }

    private static segment(value: string): string {
        return encodeURIComponent(value)
    }
}
