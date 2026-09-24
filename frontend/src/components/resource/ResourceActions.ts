import { Ban, Cable, CircleCheck, Droplets, FilePenLine, PanelRight, Play, RefreshCw, ScrollText, Scaling, SquareTerminal, Star, StarOff, Trash2 } from '@lucide/vue'
import type { TUiMenuItem } from '@/components/common/menu/types/TUiMenuItem'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'
import { KubeClusterCatalog, KubeDefaultClassCatalog, KubeWorkloadCatalog } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'

export class ResourceActions {
    public static readonly openKey: string = 'open'

    public static readonly editYamlKey: string = 'edit-yaml'

    public static readonly logsKey: string = 'logs'

    public static readonly shellKey: string = 'shell'

    public static readonly forwardKey: string = 'forward'

    public static readonly scaleKey: string = 'scale'

    public static readonly restartKey: string = 'restart'

    public static readonly triggerKey: string = 'trigger'

    public static readonly cordonKey: string = 'cordon'

    public static readonly uncordonKey: string = 'uncordon'

    public static readonly drainKey: string = 'drain'

    public static readonly setDefaultKey: string = 'set-default'

    public static readonly unsetDefaultKey: string = 'unset-default'

    public static readonly deleteKey: string = 'delete'

    public static of(kind: KubeResourceKind | null): TUiMenuItem[] {
        if (!kind) {
            return []
        }

        const items: TUiMenuItem[] = [
            { key: ResourceActions.openKey, label: 'View details', icon: PanelRight },
        ]

        if (kind.canPatch || kind.canUpdate) {
            items.push({ key: ResourceActions.editYamlKey, label: 'Edit YAML', icon: FilePenLine })
        }

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
        if (KubeDefaultClassCatalog.canSetDefault(kind)) {
            items.push({ key: ResourceActions.setDefaultKey, label: 'Set as default', icon: Star, separatorBefore: true })
            items.push({ key: ResourceActions.unsetDefaultKey, label: 'Unset default', icon: StarOff, separatorBefore: true })
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

    public static forRow(items: readonly TUiMenuItem[], row: TResourceRow): TUiMenuItem[] {
        const hidden = row.isDefault === true ? ResourceActions.setDefaultKey : ResourceActions.unsetDefaultKey

        return items.filter(item => item.key !== hidden)
    }
}
