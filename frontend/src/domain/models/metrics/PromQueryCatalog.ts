import type { TMetricScope } from '@/domain/models/metrics/types/TMetricScope'
import type { TMetricSeriesKind } from '@/domain/models/metrics/types/TMetricSeriesKind'
import type { TPrometheusLayout } from '@/domain/models/metrics/types/TPrometheusLayout'

export class PromQueryCatalog {
    public static readonly cpuMetric: string = 'container_cpu_usage_seconds_total'

    public static readonly memoryMetric: string = 'container_memory_working_set_bytes'

    public static readonly probeQuery: string = 'vector(1)'

    public static of(layout: TPrometheusLayout, kind: TMetricSeriesKind, scope: TMetricScope): string {
        const selector = PromQueryCatalog.selector(layout, scope)
        const grouping = PromQueryCatalog.groupLabelOf(layout, scope)
        const inner = kind === 'cpu'
            ? `rate(${PromQueryCatalog.cpuMetric}{${selector}}[${layout.rateWindow}])`
            : `${PromQueryCatalog.memoryMetric}{${selector}}`

        return grouping === ''
            ? `sum(${inner})`
            : `sum by (${grouping}) (${inner})`
    }

    public static probe(): string {
        return PromQueryCatalog.probeQuery
    }

    public static groupLabelOf(layout: TPrometheusLayout, scope: TMetricScope): string {
        if (scope.level === 'workload') {
            return layout.podLabel
        }

        return scope.level === 'pod' ? layout.containerLabel : ''
    }

    // cAdvisor answers with a per-pod rollup carrying no container label and with the
    // pause container under `POD`; counting either double-counts the workload.
    private static selector(layout: TPrometheusLayout, scope: TMetricScope): string {
        const terms: string[] = [
            `${layout.containerLabel}!=""`,
            `${layout.containerLabel}!="POD"`,
        ]

        if (scope.namespace) {
            terms.push(PromQueryCatalog.equals(layout.namespaceLabel, scope.namespace))
        }
        if (scope.node) {
            terms.push(PromQueryCatalog.equals(layout.nodeLabel, scope.node))
        }
        if (scope.pod) {
            terms.push(PromQueryCatalog.equals(layout.podLabel, scope.pod))
        }
        if (scope.workload && !scope.pod) {
            terms.push(PromQueryCatalog.matches(layout.podLabel, `${PromQueryCatalog.escapeRegex(scope.workload)}-.*`))
        }

        return terms.join(',')
    }

    private static equals(label: string, value: string): string {
        return `${label}="${PromQueryCatalog.escapeValue(value)}"`
    }

    private static matches(label: string, expression: string): string {
        return `${label}=~"${PromQueryCatalog.escapeValue(expression)}"`
    }

    private static escapeValue(value: string): string {
        return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    }

    private static escapeRegex(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
}
