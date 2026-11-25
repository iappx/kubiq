import { describe, expect, it } from 'vitest'
import type { TClusterEvent } from '@/application/services/clusterOverview/types/TClusterEvent'
import { OverviewEventGrouper } from '@/components/clusterOverview/OverviewEventGrouper'

const event = (
    key: string,
    reason: string,
    namespace: string,
    count: number,
    lastSeen: string,
): TClusterEvent => ({
    key,
    reason,
    message: `${reason} happened`,
    object: 'Pod: web-0',
    namespace,
    lastSeen,
    count,
    state: 'warning',
})

describe('OverviewEventGrouper', () => {
    it('aggregates occurrence counts per reason sorted by count descending', () => {
        const events = [
            event('e1', 'Unhealthy', 'prod', 40, '2026-11-25T10:00:00Z'),
            event('e2', 'CleanUpError', 'kube-system', 628, '2026-11-25T09:00:00Z'),
            event('e3', 'Unhealthy', 'staging', 29, '2026-11-25T11:00:00Z'),
        ]

        expect(OverviewEventGrouper.reasons(events)).toEqual([
            { reason: 'CleanUpError', count: 628 },
            { reason: 'Unhealthy', count: 69 },
        ])
    })

    it('groups events by namespace and labels cluster-scoped events as (cluster)', () => {
        const events = [
            event('e1', 'Unhealthy', 'prod', 5, '2026-11-25T12:00:00Z'),
            event('e2', 'NodeNotReady', '', 2, '2026-11-25T11:00:00Z'),
            event('e3', 'BackOff', 'prod', 3, '2026-11-25T10:00:00Z'),
        ]

        const groups = OverviewEventGrouper.group(events, '')

        expect(groups.map(group => group.label)).toEqual(['prod', '(cluster)'])
        expect(groups[0].events).toHaveLength(2)
        expect(groups[0].count).toBe(8)
        expect(groups[1].events).toHaveLength(1)
    })

    it('filters events by the selected reason before grouping', () => {
        const events = [
            event('e1', 'Unhealthy', 'prod', 5, '2026-11-25T12:00:00Z'),
            event('e2', 'BackOff', 'staging', 3, '2026-11-25T11:00:00Z'),
        ]

        const groups = OverviewEventGrouper.group(events, 'BackOff')

        expect(groups).toHaveLength(1)
        expect(groups[0].label).toBe('staging')
        expect(groups[0].events.map(item => item.key)).toEqual(['e2'])
    })
})
