import { Ban, CircleCheck, RefreshCw, Trash2 } from '@lucide/vue'
import type { TBulkAction } from '@/components/resource/types/TBulkAction'
import { KubeClusterCatalog, KubeWorkloadCatalog } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'

export class ResourceBulkActions {
    public static readonly restartKey: string = 'restart'

    public static readonly cordonKey: string = 'cordon'

    public static readonly uncordonKey: string = 'uncordon'

    public static readonly deleteKey: string = 'delete'

    public static availableFor(kind: KubeResourceKind | null): TBulkAction[] {
        if (!kind) {
            return []
        }

        const actions: TBulkAction[] = []

        if (KubeWorkloadCatalog.canRestart(kind)) {
            actions.push({
                key: ResourceBulkActions.restartKey,
                label: 'Restart rollout',
                icon: RefreshCw,
            })
        }
        if (KubeClusterCatalog.canCordon(kind)) {
            actions.push({
                key: ResourceBulkActions.cordonKey,
                label: 'Cordon',
                icon: Ban,
            })
            actions.push({
                key: ResourceBulkActions.uncordonKey,
                label: 'Uncordon',
                icon: CircleCheck,
            })
        }
        if (kind.canDelete) {
            actions.push({
                key: ResourceBulkActions.deleteKey,
                label: 'Delete',
                icon: Trash2,
                danger: true,
            })
        }

        return actions
    }
}
