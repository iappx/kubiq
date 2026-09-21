import type { RepoEntityBase } from '@iappx/entity-repo'
import { ResourceEventLimits } from '@/application/services/resourceEvents/constants/ResourceEventLimits'
import type { TResourceChange } from '@/application/services/resourceWatch/types/TResourceChange'
import { EventEntity } from '@/domain/entities/cluster'
import { KubeObjectKey } from '@/domain/entities/kube'

export class ResourceEventLog {
    public static of(items: readonly RepoEntityBase[]): EventEntity[] {
        return ResourceEventLog.order(items.filter((item): item is EventEntity => item instanceof EventEntity))
    }

    public static apply(current: readonly EventEntity[], changes: readonly TResourceChange[]): EventEntity[] {
        const byKey = new Map<string, EventEntity>()
        current.forEach(event => byKey.set(KubeObjectKey.of(event), event))

        changes.forEach((change) => {
            if (change.type === 'deleted') {
                byKey.delete(change.key)
                return
            }
            if (change.entity instanceof EventEntity) {
                byKey.set(change.key, change.entity)
            }
        })

        return ResourceEventLog.order([...byKey.values()])
    }

    // The API server cannot order a list, so the newest are picked out of what it served.
    private static order(events: EventEntity[]): EventEntity[] {
        return events
            .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
            .slice(0, ResourceEventLimits.shown)
    }
}
