import { Ban, Cable, CircleCheck, Droplets, PanelRight, Play, RefreshCw, ScrollText, Scaling, SquareTerminal, Trash2 } from '@lucide/vue'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import { KubeClusterCatalog, KubeWorkloadCatalog } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'

export class ResourceActions {
    public static readonly openKey: string = 'open'

    public static readonly logsKey: string = 'logs'

    public static readonly shellKey: string = 'shell'

    public static readonly forwardKey: string = 'forward'

    public static readonly scaleKey: string = 'scale'

    public static readonly restartKey: string = 'restart'

    public static readonly triggerKey: string = 'trigger'

    public static readonly cordonKey: string = 'cordon'

    public static readonly uncordonKey: string = 'uncordon'

    public static readonly drainKey: string = 'drain'

    public static readonly deleteKey: string = 'delete'

    public static of(kind: KubeResourceKind | null): TUiMenuItem[] {
        if (!kind) {
            return []
        }

        const items: TUiMenuItem[] = [
            { key: ResourceActions.openKey, label: 'View details', icon: PanelRight },
        ]

        if (KubeWorkloadCatalog.isPod(kind)) {
            items.push({ key: ResourceActions.logsKey, label: 'View logs', icon: ScrollText })
            items.push({ key: ResourceActions.shellKey, label: 'Open shell', icon: SquareTerminal })
        }
        if (KubeWorkloadCatalog.canForwardPort(kind)) {
            items.push({ key: ResourceActions.forwardKey, label: 'Forward port', icon: Cable })
        }
        if (KubeWorkloadCatalog.canScale(kind)) {
            items.push({ key: ResourceActions.scaleKey, label: 'Scale', icon: Scaling, separatorBefore: true })
        }
        if (KubeWorkloadCatalog.canRestart(kind)) {
            items.push({ key: ResourceActions.restartKey, label: 'Restart rollout', icon: RefreshCw })
        }
        if (KubeWorkloadCatalog.canTrigger(kind)) {
            items.push({ key: ResourceActions.triggerKey, label: 'Trigger now', icon: Play, separatorBefore: true })
        }
        if (KubeClusterCatalog.canCordon(kind)) {
            items.push({ key: ResourceActions.cordonKey, label: 'Cordon', icon: Ban, separatorBefore: true })
            items.push({ key: ResourceActions.uncordonKey, label: 'Uncordon', icon: CircleCheck })
        }
        if (KubeClusterCatalog.canDrain(kind)) {
            items.push({ key: ResourceActions.drainKey, label: 'Drain', icon: Droplets })
        }
        if (kind.canDelete) {
            items.push({
                key: ResourceActions.deleteKey,
                label: 'Delete',
                icon: Trash2,
                danger: true,
                separatorBefore: true,
            })
        }

        return items
    }
}
