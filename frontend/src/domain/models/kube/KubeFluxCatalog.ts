import { KubeResourceKind } from '@/domain/models/kube/KubeResourceKind'

export class KubeFluxCatalog {
    public static readonly kustomizeGroup: string = 'kustomize.toolkit.fluxcd.io'

    public static readonly helmGroup: string = 'helm.toolkit.fluxcd.io'

    public static readonly sourceGroup: string = 'source.toolkit.fluxcd.io'

    public static readonly notificationGroup: string = 'notification.toolkit.fluxcd.io'

    public static readonly imageGroup: string = 'image.toolkit.fluxcd.io'

    private static readonly groups: readonly string[] = [
        KubeFluxCatalog.kustomizeGroup,
        KubeFluxCatalog.helmGroup,
        KubeFluxCatalog.sourceGroup,
        KubeFluxCatalog.notificationGroup,
        KubeFluxCatalog.imageGroup,
    ]

    private static readonly icons: Record<string, string> = {
        [KubeResourceKind.registryKeyOf(KubeFluxCatalog.kustomizeGroup, 'kustomizations')]: 'Layers',
        [KubeResourceKind.registryKeyOf(KubeFluxCatalog.helmGroup, 'helmreleases')]: 'Blocks',
        [KubeResourceKind.registryKeyOf(KubeFluxCatalog.sourceGroup, 'gitrepositories')]: 'FolderTree',
        [KubeResourceKind.registryKeyOf(KubeFluxCatalog.sourceGroup, 'helmrepositories')]: 'Archive',
        [KubeResourceKind.registryKeyOf(KubeFluxCatalog.sourceGroup, 'ocirepositories')]: 'Box',
        [KubeResourceKind.registryKeyOf(KubeFluxCatalog.sourceGroup, 'buckets')]: 'Database',
        [KubeResourceKind.registryKeyOf(KubeFluxCatalog.sourceGroup, 'helmcharts')]: 'FileText',
    }

    private static readonly groupIcons: Record<string, string> = {
        [KubeFluxCatalog.kustomizeGroup]: 'Layers',
        [KubeFluxCatalog.helmGroup]: 'Blocks',
        [KubeFluxCatalog.sourceGroup]: 'FolderTree',
        [KubeFluxCatalog.notificationGroup]: 'Bell',
        [KubeFluxCatalog.imageGroup]: 'Disc',
    }

    private static readonly orders: Record<string, number> = {
        [KubeResourceKind.registryKeyOf(KubeFluxCatalog.kustomizeGroup, 'kustomizations')]: 1,
        [KubeResourceKind.registryKeyOf(KubeFluxCatalog.helmGroup, 'helmreleases')]: 2,
        [KubeResourceKind.registryKeyOf(KubeFluxCatalog.sourceGroup, 'gitrepositories')]: 3,
        [KubeResourceKind.registryKeyOf(KubeFluxCatalog.sourceGroup, 'helmrepositories')]: 4,
        [KubeResourceKind.registryKeyOf(KubeFluxCatalog.sourceGroup, 'ocirepositories')]: 5,
        [KubeResourceKind.registryKeyOf(KubeFluxCatalog.sourceGroup, 'buckets')]: 6,
        [KubeResourceKind.registryKeyOf(KubeFluxCatalog.sourceGroup, 'helmcharts')]: 7,
    }

    private static readonly groupOrders: Record<string, number> = {
        [KubeFluxCatalog.kustomizeGroup]: 20,
        [KubeFluxCatalog.helmGroup]: 30,
        [KubeFluxCatalog.sourceGroup]: 40,
        [KubeFluxCatalog.imageGroup]: 50,
        [KubeFluxCatalog.notificationGroup]: 60,
    }

    public static isFlux(group: string): boolean {
        return KubeFluxCatalog.groups.includes(group)
    }

    public static iconOf(group: string, resource: string): string {
        const key = KubeResourceKind.registryKeyOf(group, resource)

        return KubeFluxCatalog.icons[key] ?? KubeFluxCatalog.groupIcons[group] ?? 'Waypoints'
    }

    public static orderOf(group: string, resource: string): number {
        const key = KubeResourceKind.registryKeyOf(group, resource)

        return KubeFluxCatalog.orders[key] ?? KubeFluxCatalog.groupOrders[group] ?? 99
    }
}
