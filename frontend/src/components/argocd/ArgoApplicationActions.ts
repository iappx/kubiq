import { History, RefreshCcwDot, RefreshCw, Trash2 } from '@lucide/vue'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'

// The table hands one menu to every row, so what belongs here is what holds for all of them.
// Stopping a running sync depends on the single application and lives in the detail panel.
export class ArgoApplicationActions {
    public static readonly sync: string = 'sync'

    public static readonly refresh: string = 'refresh'

    public static readonly hardRefresh: string = 'hard-refresh'

    public static readonly history: string = 'history'

    public static readonly remove: string = 'remove'

    public static forCapabilities(canSync: boolean, canDelete: boolean): TUiMenuItem[] {
        const items: TUiMenuItem[] = []

        if (canSync) {
            items.push({ key: ArgoApplicationActions.sync, label: 'Sync…', icon: RefreshCw })
            items.push({ key: ArgoApplicationActions.refresh, label: 'Refresh', icon: RefreshCcwDot })
            items.push({ key: ArgoApplicationActions.hardRefresh, label: 'Hard refresh', icon: RefreshCcwDot })
        }

        items.push({ key: ArgoApplicationActions.history, label: 'History', icon: History })

        if (canDelete) {
            items.push({
                key: ArgoApplicationActions.remove,
                label: 'Delete…',
                icon: Trash2,
                danger: true,
                separatorBefore: true,
            })
        }

        return items
    }
}
