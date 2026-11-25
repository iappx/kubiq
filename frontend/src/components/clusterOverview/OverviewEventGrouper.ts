import type { TClusterEvent } from '@/application/services/clusterOverview/types/TClusterEvent'
import type { TEventNamespaceGroup } from '@/components/clusterOverview/types/TEventNamespaceGroup'
import type { TEventReasonPill } from '@/components/clusterOverview/types/TEventReasonPill'

export class OverviewEventGrouper {
    public static readonly clusterScopeLabel: string = '(cluster)'

    public static readonly fallbackReason: string = 'Unknown'

    public static reasons(events: readonly TClusterEvent[]): TEventReasonPill[] {
        const counts = new Map<string, number>()

        for (const event of events) {
            const reason = event.reason || OverviewEventGrouper.fallbackReason
            counts.set(reason, (counts.get(reason) ?? 0) + Math.max(1, event.count))
        }

        return [...counts.entries()]
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => (b.count - a.count) || a.reason.localeCompare(b.reason))
    }

    public static group(events: readonly TClusterEvent[], activeReason: string): TEventNamespaceGroup[] {
        const filtered = activeReason === ''
            ? events
            : events.filter(event => (event.reason || OverviewEventGrouper.fallbackReason) === activeReason)

        const byNamespace = new Map<string, TClusterEvent[]>()

        for (const event of filtered) {
            const list = byNamespace.get(event.namespace) ?? []
            list.push(event)
            byNamespace.set(event.namespace, list)
        }

        return [...byNamespace.entries()]
            .map(([namespace, items]) => ({
                namespace,
                label: namespace || OverviewEventGrouper.clusterScopeLabel,
                events: items,
                count: items.reduce((sum, item) => sum + Math.max(1, item.count), 0),
            }))
            .sort((a, b) => OverviewEventGrouper.compareGroups(a, b))
    }

    private static compareGroups(left: TEventNamespaceGroup, right: TEventNamespaceGroup): number {
        const leftSeen = left.events[0]?.lastSeen ?? ''
        const rightSeen = right.events[0]?.lastSeen ?? ''
        const byTime = rightSeen.localeCompare(leftSeen)

        return byTime !== 0 ? byTime : left.label.localeCompare(right.label)
    }
}
