import { ArrowRight, PanelRight, Pin, PinOff, Plug, Unplug } from '@lucide/vue'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'

export class ClusterCatalogActions {
    public static readonly enterKey: string = 'enter'

    public static readonly detailsKey: string = 'details'

    public static readonly connectKey: string = 'connect'

    public static readonly disconnectKey: string = 'disconnect'

    public static readonly pinKey: string = 'pin'

    public static of(row: TClusterRow | null): TUiMenuItem[] {
        const items: TUiMenuItem[] = []

        if (row?.status === 'connected') {
            items.push({ key: ClusterCatalogActions.enterKey, label: 'Open cluster', icon: ArrowRight })
        }

        items.push({ key: ClusterCatalogActions.detailsKey, label: 'View details', icon: PanelRight })

        if (!row) {
            return items
        }

        if (row.status === 'connected') {
            items.push({
                key: ClusterCatalogActions.disconnectKey,
                label: 'Disconnect',
                icon: Unplug,
                separatorBefore: true,
            })
        } else if (row.status !== 'connecting' && row.status !== 'unsupported') {
            items.push({
                key: ClusterCatalogActions.connectKey,
                label: 'Connect',
                icon: Plug,
                separatorBefore: true,
            })
        }

        items.push({
            key: ClusterCatalogActions.pinKey,
            label: row.isPinned ? 'Unpin' : 'Pin',
            icon: row.isPinned ? PinOff : Pin,
            separatorBefore: true,
        })

        return items
    }
}
