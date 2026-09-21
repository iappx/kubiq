import type { TTab } from '@/components/common/tabBar/UiTabBar.vue'

export class HelmDetailTabs {
    public static readonly overviewKey: string = 'overview'

    public static readonly valuesKey: string = 'values'

    public static readonly manifestKey: string = 'manifest'

    public static readonly resourcesKey: string = 'resources'

    public static readonly notesKey: string = 'notes'

    public static readonly historyKey: string = 'history'

    public static all(): TTab[] {
        return [
            { key: HelmDetailTabs.overviewKey, label: 'Overview' },
            { key: HelmDetailTabs.valuesKey, label: 'Values' },
            { key: HelmDetailTabs.resourcesKey, label: 'Resources' },
            { key: HelmDetailTabs.manifestKey, label: 'Manifest' },
            { key: HelmDetailTabs.notesKey, label: 'Notes' },
            { key: HelmDetailTabs.historyKey, label: 'History' },
        ]
    }
}
