import type { TPrometheusLayout } from '@/domain/models/metrics/types/TPrometheusLayout'
import type { TPrometheusLayoutId } from '@/domain/models/metrics/types/TPrometheusLayoutId'

export class PrometheusLayoutCatalog {
    public static readonly Default: TPrometheusLayoutId = 'kubePrometheusStack'

    private static readonly layouts: Record<TPrometheusLayoutId, TPrometheusLayout> = {
        kubePrometheusStack: {
            id: 'kubePrometheusStack',
            title: 'kube-prometheus-stack',
            description: 'cAdvisor series carry namespace, pod, container and node',
            namespaceLabel: 'namespace',
            podLabel: 'pod',
            containerLabel: 'container',
            nodeLabel: 'node',
            rateWindow: '5m',
        },
        victoriaMetrics: {
            id: 'victoriaMetrics',
            title: 'VictoriaMetrics',
            description: 'Same cAdvisor names as the operator stack writes them',
            namespaceLabel: 'namespace',
            podLabel: 'pod',
            containerLabel: 'container',
            nodeLabel: 'node',
            rateWindow: '5m',
        },
        prometheusChart: {
            id: 'prometheusChart',
            title: 'Prometheus Helm chart',
            description: 'Kubernetes labels keep their relabelled prefixes',
            namespaceLabel: 'namespace',
            podLabel: 'pod',
            containerLabel: 'container',
            nodeLabel: 'kubernetes_io_hostname',
            rateWindow: '5m',
        },
    }

    public static all(): TPrometheusLayout[] {
        return PrometheusLayoutCatalog.ids().map(id => PrometheusLayoutCatalog.layouts[id])
    }

    public static ids(): TPrometheusLayoutId[] {
        return Object.keys(PrometheusLayoutCatalog.layouts) as TPrometheusLayoutId[]
    }

    public static has(id: string): boolean {
        return Object.prototype.hasOwnProperty.call(PrometheusLayoutCatalog.layouts, id)
    }

    public static parse(id: unknown): TPrometheusLayoutId {
        return typeof id === 'string' && PrometheusLayoutCatalog.has(id)
            ? id as TPrometheusLayoutId
            : PrometheusLayoutCatalog.Default
    }

    public static of(id: unknown): TPrometheusLayout {
        return PrometheusLayoutCatalog.layouts[PrometheusLayoutCatalog.parse(id)]
    }

    public static title(id: unknown): string {
        return PrometheusLayoutCatalog.of(id).title
    }
}
