import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { DetailTabs } from '@/components/resource/detail/DetailTabs'
import type { TTab } from '@/components/common/tabBar/UiTabBar.vue'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'
import { KubeObjectStateCatalog } from '@/domain/entities/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import type { TRouteQueryField } from '@/lib/router/query/types/TRouteQueryField'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'

export class ResourceSelection {
    public static fields(
        ui: AppUiStore,
        readTab: () => string,
        writeTab: (tab: string) => void,
    ): TRouteQueryField[] {
        return [
            {
                key: ClusterRoutes.namespaceKey,
                read: () => (ui.detailOpen ? ui.detailNamespace : ''),
                write: namespace => ui.openDetail(namespace, ui.detailName),
            },
            {
                key: ClusterRoutes.nameKey,
                read: () => ui.detailName,
                write: name => ui.openDetail(ui.detailNamespace, name),
            },
            {
                key: ClusterRoutes.tabKey,
                read: readTab,
                write: writeTab,
                defaultValue: DetailTabs.overviewKey,
            },
        ]
    }

    public static isAddressable(kind: KubeResourceKind | null, namespace: string, name: string): boolean {
        if (name === '') {
            return false
        }

        return !(kind !== null && kind.namespaced && namespace === '')
    }

    public static tabOf(tabs: readonly TTab[], requested: string): string {
        return DetailTabs.has(tabs, requested) ? requested : DetailTabs.overviewKey
    }

    // A deep link names an object the list need not hold — another namespace scope, a kind still loading.
    public static rowOf(namespace: string, name: string): TResourceRow {
        return {
            key: namespace === '' ? name : `${namespace}/${name}`,
            name,
            namespace,
            createdAt: '',
            tone: 'unknown',
            statusTitle: KubeObjectStateCatalog.title('unknown'),
        }
    }
}
