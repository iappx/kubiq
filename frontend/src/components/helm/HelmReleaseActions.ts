import { History, RefreshCw, Trash2 } from '@lucide/vue'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'

export class HelmReleaseActions {
    public static readonly upgrade: string = 'upgrade'

    public static readonly history: string = 'history'

    public static readonly uninstall: string = 'uninstall'

    public static all(): TUiMenuItem[] {
        return [
            { key: HelmReleaseActions.upgrade, label: 'Upgrade…', icon: RefreshCw },
            { key: HelmReleaseActions.history, label: 'History', icon: History },
            { key: HelmReleaseActions.uninstall, label: 'Uninstall…', icon: Trash2, danger: true, separatorBefore: true },
        ]
    }
}
