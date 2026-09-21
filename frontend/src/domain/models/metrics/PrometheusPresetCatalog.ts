import type { TPrometheusLayoutId } from '@/domain/models/metrics/types/TPrometheusLayoutId'
import type { TPrometheusPreset } from '@/domain/models/metrics/types/TPrometheusPreset'

export class PrometheusPresetCatalog {
    private static readonly presets: TPrometheusPreset[] = [
        {
            id: 'kubePrometheusStack',
            title: 'kube-prometheus-stack',
            labelSelector: 'operated-prometheus=true',
            portNames: ['web', 'http-web'],
            portNumbers: [9090],
        },
        {
            id: 'victoriaMetrics',
            title: 'VictoriaMetrics',
            labelSelector: 'app.kubernetes.io/name in (vmsingle,victoria-metrics-single)',
            portNames: ['http'],
            portNumbers: [8429, 8428],
        },
        {
            id: 'prometheusChart',
            title: 'Prometheus Helm chart',
            labelSelector: 'app.kubernetes.io/name=prometheus,app.kubernetes.io/component=server',
            portNames: ['http', 'web'],
            portNumbers: [80, 9090],
        },
    ]

    public static all(): TPrometheusPreset[] {
        return [...PrometheusPresetCatalog.presets]
    }

    public static of(id: TPrometheusLayoutId): TPrometheusPreset | undefined {
        return PrometheusPresetCatalog.presets.find(preset => preset.id === id)
    }

    // An API server proxy address takes a port name as readily as a number.
    public static portOf(preset: TPrometheusPreset, ports: readonly { name?: string; port?: number }[]): string {
        const byName = ports.find(port => port.name !== undefined && preset.portNames.includes(port.name))
        if (byName?.name) {
            return byName.name
        }

        const byNumber = ports.find(port => port.port !== undefined && preset.portNumbers.includes(port.port))
        if (byNumber?.port !== undefined) {
            return String(byNumber.port)
        }

        const first = ports[0]
        if (first?.name) {
            return first.name
        }

        return first?.port !== undefined ? String(first.port) : ''
    }
}
