import { KubeResourceKind } from '@/domain/models/kube/KubeResourceKind'

export class KubeWorkloadCatalog {
    public static readonly podsKey: string = KubeResourceKind.registryKeyOf('', 'pods')

    public static readonly jobsKey: string = KubeResourceKind.registryKeyOf('batch', 'jobs')

    public static readonly cronJobsKey: string = KubeResourceKind.registryKeyOf('batch', 'cronjobs')

    private static readonly scalable: string[] = [
        KubeResourceKind.registryKeyOf('apps', 'deployments'),
        KubeResourceKind.registryKeyOf('apps', 'statefulsets'),
        KubeResourceKind.registryKeyOf('apps', 'replicasets'),
        KubeResourceKind.registryKeyOf('', 'replicationcontrollers'),
    ]

    private static readonly restartable: string[] = [
        KubeResourceKind.registryKeyOf('apps', 'deployments'),
        KubeResourceKind.registryKeyOf('apps', 'statefulsets'),
        KubeResourceKind.registryKeyOf('apps', 'daemonsets'),
    ]

    private static readonly summarised: string[] = [
        KubeWorkloadCatalog.podsKey,
        KubeResourceKind.registryKeyOf('apps', 'deployments'),
        KubeResourceKind.registryKeyOf('apps', 'statefulsets'),
        KubeResourceKind.registryKeyOf('apps', 'daemonsets'),
    ]

    public static canScale(kind: KubeResourceKind): boolean {
        return kind.canPatch && KubeWorkloadCatalog.scalable.includes(kind.registryKey)
    }

    public static canRestart(kind: KubeResourceKind): boolean {
        return kind.canPatch && KubeWorkloadCatalog.restartable.includes(kind.registryKey)
    }

    public static canTrigger(kind: KubeResourceKind): boolean {
        return kind.registryKey === KubeWorkloadCatalog.cronJobsKey
    }

    public static isPod(kind: KubeResourceKind): boolean {
        return kind.registryKey === KubeWorkloadCatalog.podsKey
    }

    public static isSummarised(kind: KubeResourceKind): boolean {
        return KubeWorkloadCatalog.summarised.includes(kind.registryKey)
    }

    public static summaryOrder(kind: KubeResourceKind): number {
        return KubeWorkloadCatalog.summarised.indexOf(kind.registryKey)
    }
}
