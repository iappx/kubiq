import { KubeResourceKind } from '@/domain/models/kube/KubeResourceKind'

export class MetricsKinds {
    public static readonly group: string = 'metrics.k8s.io'

    public static readonly version: string = 'v1beta1'

    public static nodes(): KubeResourceKind {
        return MetricsKinds.build('nodes', 'NodeMetrics', 'Node metrics', false)
    }

    public static pods(): KubeResourceKind {
        return MetricsKinds.build('pods', 'PodMetrics', 'Pod metrics', true)
    }

    private static build(resource: string, kind: string, title: string, namespaced: boolean): KubeResourceKind {
        return new KubeResourceKind({
            group: MetricsKinds.group,
            version: MetricsKinds.version,
            resource,
            kind,
            title,
            namespaced,
            section: 'cluster',
            icon: 'activity',
            columns: [],
            verbs: ['get', 'list'],
        })
    }
}
