import { KubeResourceKind } from '@/domain/models/kube/KubeResourceKind'

export class KubeWorkloadCatalog {
    public static readonly podsKey: string = KubeResourceKind.registryKeyOf('', 'pods')

    public static readonly jobsKey: string = KubeResourceKind.registryKeyOf('batch', 'jobs')

    public static readonly cronJobsKey: string = KubeResourceKind.registryKeyOf('batch', 'cronjobs')

    public static readonly servicesKey: string = KubeResourceKind.registryKeyOf('', 'services')

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

    private static readonly loggableWorkloads: string[] = [
        KubeResourceKind.registryKeyOf('apps', 'deployments'),
        KubeResourceKind.registryKeyOf('apps', 'statefulsets'),
        KubeResourceKind.registryKeyOf('apps', 'daemonsets'),
        KubeResourceKind.registryKeyOf('apps', 'replicasets'),
        KubeWorkloadCatalog.jobsKey,
    ]

    private static readonly podNamePrefixed: string[] = [
        KubeResourceKind.registryKeyOf('apps', 'deployments'),
        KubeResourceKind.registryKeyOf('apps', 'statefulsets'),
        KubeResourceKind.registryKeyOf('apps', 'daemonsets'),
        KubeResourceKind.registryKeyOf('apps', 'replicasets'),
        KubeResourceKind.registryKeyOf('', 'replicationcontrollers'),
        KubeWorkloadCatalog.jobsKey,
        KubeWorkloadCatalog.cronJobsKey,
    ]

    private static readonly podTemplated: string[] = [
        KubeResourceKind.registryKeyOf('apps', 'deployments'),
        KubeResourceKind.registryKeyOf('apps', 'statefulsets'),
        KubeResourceKind.registryKeyOf('apps', 'daemonsets'),
        KubeResourceKind.registryKeyOf('apps', 'replicasets'),
        KubeResourceKind.registryKeyOf('', 'replicationcontrollers'),
        KubeWorkloadCatalog.jobsKey,
        KubeWorkloadCatalog.cronJobsKey,
    ]

    private static readonly summarised: string[] = [
        KubeWorkloadCatalog.podsKey,
        KubeResourceKind.registryKeyOf('apps', 'deployments'),
        KubeResourceKind.registryKeyOf('apps', 'statefulsets'),
        KubeResourceKind.registryKeyOf('apps', 'daemonsets'),
    ]

    private static readonly overviewKinds: string[] = [
        KubeResourceKind.registryKeyOf('', 'nodes'),
        KubeResourceKind.registryKeyOf('', 'persistentvolumes'),
        KubeWorkloadCatalog.podsKey,
        KubeResourceKind.registryKeyOf('apps', 'deployments'),
        KubeResourceKind.registryKeyOf('apps', 'daemonsets'),
        KubeResourceKind.registryKeyOf('apps', 'statefulsets'),
        KubeWorkloadCatalog.cronJobsKey,
        KubeWorkloadCatalog.jobsKey,
        KubeResourceKind.registryKeyOf('autoscaling', 'horizontalpodautoscalers'),
        KubeResourceKind.registryKeyOf('', 'resourcequotas'),
        KubeResourceKind.registryKeyOf('policy', 'poddisruptionbudgets'),
        KubeResourceKind.registryKeyOf('', 'persistentvolumeclaims'),
        KubeResourceKind.registryKeyOf('cert-manager.io', 'certificates'),
        KubeResourceKind.registryKeyOf('kustomize.toolkit.fluxcd.io', 'kustomizations'),
        KubeResourceKind.registryKeyOf('helm.toolkit.fluxcd.io', 'helmreleases'),
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

    public static canSuspend(kind: KubeResourceKind): boolean {
        return kind.canPatch && kind.registryKey === KubeWorkloadCatalog.cronJobsKey
    }

    public static isPod(kind: KubeResourceKind): boolean {
        return kind.registryKey === KubeWorkloadCatalog.podsKey
    }

    public static isLoggableWorkload(kind: KubeResourceKind): boolean {
        return KubeWorkloadCatalog.loggableWorkloads.includes(kind.registryKey)
    }

    public static canViewLogs(kind: KubeResourceKind): boolean {
        return KubeWorkloadCatalog.isPod(kind) || KubeWorkloadCatalog.isLoggableWorkload(kind)
    }

    public static canDebug(kind: KubeResourceKind): boolean {
        return KubeWorkloadCatalog.isPod(kind) && (kind.canPatch || kind.canUpdate)
    }

    public static canForwardPort(kind: KubeResourceKind): boolean {
        return kind.registryKey === KubeWorkloadCatalog.podsKey
            || kind.registryKey === KubeWorkloadCatalog.servicesKey
    }

    public static hasPodTemplate(kind: KubeResourceKind): boolean {
        return KubeWorkloadCatalog.podTemplated.includes(kind.registryKey)
    }

    public static gathersPodsByNamePrefix(kind: KubeResourceKind): boolean {
        return KubeWorkloadCatalog.podNamePrefixed.includes(kind.registryKey)
    }

    public static isSummarised(kind: KubeResourceKind): boolean {
        return KubeWorkloadCatalog.summarised.includes(kind.registryKey)
    }

    public static summaryOrder(kind: KubeResourceKind): number {
        return KubeWorkloadCatalog.summarised.indexOf(kind.registryKey)
    }

    public static isOverviewSummarised(kind: KubeResourceKind): boolean {
        return KubeWorkloadCatalog.overviewKinds.includes(kind.registryKey)
    }

    public static overviewOrder(kind: KubeResourceKind): number {
        return KubeWorkloadCatalog.overviewKinds.indexOf(kind.registryKey)
    }
}
