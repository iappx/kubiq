import type { TTab } from '@/components/common/tabBar/UiTabBar.vue'

export class ArgoDetailTabs {
    public static readonly overviewKey: string = 'overview'

    public static readonly resourcesKey: string = 'resources'

    public static readonly historyKey: string = 'history'

    public static readonly conditionsKey: string = 'conditions'

    public static all(): TTab[] {
        return [
            { key: ArgoDetailTabs.overviewKey, label: 'Overview' },
            { key: ArgoDetailTabs.resourcesKey, label: 'Resources' },
            { key: ArgoDetailTabs.historyKey, label: 'History' },
            { key: ArgoDetailTabs.conditionsKey, label: 'Conditions' },
        ]
    }
}
