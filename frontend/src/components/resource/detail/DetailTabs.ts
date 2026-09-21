import type { TTab } from '@/components/common/tabBar/UiTabBar.vue'
import { MetricsScope } from '@/components/metrics/MetricsScope'
import { KubeClusterCatalog } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'

export class DetailTabs {
    public static readonly overviewKey: string = 'overview'

    public static readonly dataKey: string = 'data'

    public static readonly podsKey: string = 'pods'

    public static readonly metricsKey: string = 'metrics'

    public static readonly metadataKey: string = 'metadata'

    public static readonly eventsKey: string = 'events'

    public static readonly yamlKey: string = 'yaml'

    public static of(kind: KubeResourceKind | null): TTab[] {
        const tabs: TTab[] = [
            { key: DetailTabs.overviewKey, label: 'Overview' },
        ]

        if (kind && KubeClusterCatalog.hasDataMap(kind)) {
            tabs.push({ key: DetailTabs.dataKey, label: 'Data' })
        }
        if (kind && KubeClusterCatalog.isNode(kind)) {
            tabs.push({ key: DetailTabs.podsKey, label: 'Pods' })
        }
        if (kind && DetailTabs.hasMetrics(kind)) {
            tabs.push({ key: DetailTabs.metricsKey, label: 'Metrics' })
        }

        tabs.push({ key: DetailTabs.metadataKey, label: 'Metadata' })
        tabs.push({ key: DetailTabs.eventsKey, label: 'Events' })

        if (kind?.canList !== false) {
            tabs.push({ key: DetailTabs.yamlKey, label: 'YAML' })
        }

        return tabs
    }

    public static has(tabs: readonly TTab[], key: string): boolean {
        return tabs.some(tab => tab.key === key)
    }

    public static hasMetrics(kind: KubeResourceKind): boolean {
        return MetricsScope.supportsHistory(kind)
    }
}
